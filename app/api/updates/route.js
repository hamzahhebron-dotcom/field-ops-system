import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

const STATUS_EVENTS = {
  departed_to_location: {
    label: 'Departed to location',
    visit_status: 'departed',
    time_field: 'actual_departure_time',
  },
  arrived_at_location: {
    label: 'Arrived at location',
    visit_status: 'arrived',
    time_field: 'arrival_time_at_destination',
  },
  data_collection_started: {
    label: 'Data collection started',
    visit_status: 'in_progress',
    time_field: null,
  },
  data_collection_finished: {
    label: 'Data collection finished',
    visit_status: 'collection_done',
    time_field: null,
  },
  departing_to_base: {
    label: 'Departing to home base',
    visit_status: 'returning',
    time_field: 'departure_from_destination',
  },
  arrived_at_base: {
    label: 'Arrived at home base',
    visit_status: 'completed',
    time_field: 'arrival_home_base_time',
  },
}

async function parseWithAI(rawText) {
  const systemPrompt = `You are a field operations update parser for a humanitarian monitoring team. You receive free-text updates about field enumerators, in English or Arabic. You must return ONLY valid JSON, no other text, no markdown, no code fences.

The JSON must have exactly this structure:
{
  "status": one of "departed" | "arrived" | "in_progress" | "collection_done" | "returning" | "delayed" | "issue" | "unknown",
  "currentLocation": string or null,
  "riskLevel": one of "none" | "low" | "medium" | "high",
  "securityIssue": true or false,
  "delayFlag": true or false,
  "accessDenied": true or false,
  "dataQualityIssue": true or false,
  "cleanedReadableUpdate": string (see CLEANED TEXT RULES below),
  "confidence": number between 0 and 1,
  "needsHumanReview": true or false
}

CLEANED TEXT RULES — THIS IS A CLEANUP, NOT A SUMMARY:
- cleanedReadableUpdate must preserve EVERY fact from the original: all numbers, durations, times, names, places, quantities, conditions, and plans. NOTHING may be omitted, shortened, or generalized.
- Only fix grammar, spelling, and awkward phrasing. Keep the same level of detail, even if the result is several sentences long.
- If the text is in Arabic, translate it fully to English — a complete translation, not a summary.
- If the original is already clear English, return it nearly unchanged.
- It is a FAILURE to drop a detail. When unsure whether something matters, keep it.

Example:
Original: "Signal received from Serghei that convoy moved, will take 80 min to arrive at warehouse, enumerators r 20 min away and will remain on standby"
CORRECT: "Signal received from Serghei that the convoy has moved and will take 80 minutes to arrive at the warehouse; the enumerators are 20 minutes away and will remain on standby."
WRONG: "The convoy is on the way and enumerators are waiting." (details dropped — never do this)

FLAG DEFINITIONS — flags mark PROBLEMS, not routine field procedures.

CRITICAL PRINCIPLE — ROUTINE vs INCIDENT:
Normal field procedures are NOT flagged. These are all ROUTINE and get NO flags:
- Waiting at a gate/door for security or guards to grant entry (standard check-in procedure)
- Routine ID checks, registration, sign-in at facilities
- Normal waiting at checkpoints without trouble
- Coordination pauses (waiting for a focal point, waiting for a convoy signal, standby)
A flag requires an actual PROBLEM: a threat, a refusal, a loss, an abnormal situation.

securityIssue = true ONLY when there is an actual safety concern:
- Security incidents, threats, shooting, shelling, detention, arrest
- Checkpoint trouble BEYOND routine waiting (harassment, confiscation, being held)
- LOSS OF CONTACT: the enumerator is unreachable, not responding, silent, missing, or has not checked in for an extended period — this is ALWAYS a security issue, never a data quality issue
- Evacuations, closures for security reasons, nearby hostilities
- The mere presence of the WORD "security" (e.g. "waiting for security to open the gate") is NOT a security issue.

delayFlag = true ONLY when the update states the visit is actually running behind schedule or explicitly calls it a delay. Routine short waits that are part of normal procedure are NOT delays.

accessDenied = true ONLY when entry was actually REFUSED: turned away, site closed to them, permission denied. WAITING to be let in is not access denied — being told NO is.

dataQualityIssue = true ONLY for problems with the collected data itself:
- Respondents unavailable or refusing interviews
- Not all beneficiaries reached, sampling incomplete
- Tools could not be applied, forms incomplete
This flag is about THE DATA, never about the enumerator's safety or reachability.

EXAMPLES:
- "Team at the door waiting for security to let them in" → NO FLAGS (routine entry procedure)
- "Waiting at reception for the focal point" → NO FLAGS (routine)
- "Passed the checkpoint after normal ID check" → NO FLAGS (routine)
- "Enumerator hasn't responded for 3 hours" → securityIssue: true, riskLevel: "medium" or higher
- "We lost contact with Yaser" → securityIssue: true
- "Held at checkpoint for 2 hours, soldiers took their IDs" → securityIssue: true, delayFlag: true
- "Only reached 60% of beneficiaries" → dataQualityIssue: true
- "Turned away at the gate by authorities, visit cannot proceed" → accessDenied: true
- "Stuck in traffic, 30 min behind schedule" → delayFlag: true
- "Shooting heard near the site, team sheltering" → securityIssue: true, riskLevel: "high"

STRICT RULES:
- Do NOT invent information that is not in the text. Flags are false unless the text clearly indicates an actual problem.
- When in doubt whether something is routine or a problem, do NOT flag it.
- Multiple flags can be true at once when the text supports them.
- Only set "status" if the text CLEARLY states a movement or stage change. Otherwise use "unknown".
- NEVER set status to any completion or return state based on future plans or intentions.
- If the text is unclear or you are not confident, set needsHumanReview to true and confidence below 0.5.
- Return ONLY the JSON object. Nothing else.`

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText },
      ],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error('OpenAI error: ' + errText)
  }

  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}

// Submit a new update (button event, comment, cancellation, or combination)
export async function POST(request) {
  try {
    const body = await request.json()

    if (!body.visit_id) {
      return NextResponse.json({ error: 'Missing visit' }, { status: 400 })
    }

    const isCancellation = body.cancel_visit === true
    const hasEvent = body.status_event && STATUS_EVENTS[body.status_event]
    const hasComment = body.raw_text && body.raw_text.trim().length > 0

    if (!isCancellation && !hasEvent && !hasComment) {
      return NextResponse.json(
        { error: 'Choose a status button or write a comment' },
        { status: 400 }
      )
    }

    const eventTime = body.event_time
      ? new Date(body.event_time).toISOString()
      : new Date().toISOString()

    const results = []

    // ---- 0. Cancellation (closes the visit as Cancelled) ----
    if (isCancellation) {
      const reason = (body.cancel_reason || '').trim()
      if (!reason) {
        return NextResponse.json(
          { error: 'A cancellation reason is required' },
          { status: 400 }
        )
      }

      const label = 'Visit cancelled — ' + reason

      const { data: cancelRow, error: cancelError } = await supabaseAdmin
        .from('visit_updates')
        .insert({
          visit_id: body.visit_id,
          raw_text: '[BUTTON] ' + label,
          parsed_status: 'cancelled',
          cleaned_readable_update: label,
          confidence: 1,
          needs_human_review: false,
          event_time: eventTime,
        })
        .select()
        .single()

      if (cancelError) {
        return NextResponse.json({ error: cancelError.message }, { status: 400 })
      }
      results.push(cancelRow)

      await supabaseAdmin
        .from('visits')
        .update({
          completed: true,
          outcome: 'cancelled',
          current_status: 'cancelled',
          latest_update: label,
          arrival_home_base_time: eventTime,
        })
        .eq('id', body.visit_id)

      return NextResponse.json({ updates: results })
    }

    // ---- 1. Button event (exact, no AI, never flagged) ----
    if (hasEvent) {
      const event = STATUS_EVENTS[body.status_event]
      const isClosing = body.status_event === 'arrived_at_base'

      const outcome = isClosing
        ? (body.outcome === 'partial' ? 'partial' : 'completed')
        : null

      const label = isClosing
        ? (outcome === 'partial'
            ? 'Arrived at home base — visit partially completed'
            : 'Arrived at home base — visit completed')
        : event.label

      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from('visit_updates')
        .insert({
          visit_id: body.visit_id,
          raw_text: '[BUTTON] ' + label,
          parsed_status: event.visit_status,
          cleaned_readable_update: label,
          confidence: 1,
          needs_human_review: false,
          event_time: eventTime,
        })
        .select()
        .single()

      if (eventError) {
        return NextResponse.json({ error: eventError.message }, { status: 400 })
      }
      results.push(eventRow)

      const visitUpdate = {
        current_status: event.visit_status,
        latest_update: label,
      }
      if (event.time_field) {
        visitUpdate[event.time_field] = eventTime
      }
      if (isClosing) {
        visitUpdate.completed = true
        visitUpdate.outcome = outcome
      }

      await supabaseAdmin
        .from('visits')
        .update(visitUpdate)
        .eq('id', body.visit_id)
    }

    // ---- 2. Free-text comment (AI parsed — flags and cleanup ONLY, never status) ----
    if (hasComment) {
      let ai = null
      try {
        ai = await parseWithAI(body.raw_text)
      } catch (e) {
        ai = null
      }

      const { data: commentRow, error: commentError } = await supabaseAdmin
        .from('visit_updates')
        .insert({
          visit_id: body.visit_id,
          raw_text: body.raw_text,
          parsed_status: ai ? ai.status : null,
          parsed_location: ai ? ai.currentLocation : null,
          parsed_risk_level: ai ? ai.riskLevel : null,
          security_issue: ai ? ai.securityIssue : false,
          delay_flag: ai ? ai.delayFlag : false,
          access_denied: ai ? ai.accessDenied : false,
          data_quality_issue: ai ? ai.dataQualityIssue : false,
          cleaned_readable_update: ai ? ai.cleanedReadableUpdate : null,
          ai_json: ai,
          confidence: ai ? ai.confidence : null,
          needs_human_review: ai ? ai.needsHumanReview : true,
          event_time: eventTime,
        })
        .select()
        .single()

      if (commentError) {
        return NextResponse.json({ error: commentError.message }, { status: 400 })
      }
      results.push(commentRow)

      // Comments never change visit status — only status buttons do.
      await supabaseAdmin
        .from('visits')
        .update({
          latest_update: ai && ai.cleanedReadableUpdate ? ai.cleanedReadableUpdate : body.raw_text,
        })
        .eq('id', body.visit_id)
    }

    return NextResponse.json({ updates: results })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Edit an update's text or flags
export async function PATCH(request) {
  try {
    const body = await request.json()

    if (!body.update_id) {
      return NextResponse.json({ error: 'Missing update id' }, { status: 400 })
    }

    const changes = {}
    if (typeof body.new_text === 'string' && body.new_text.trim().length > 0) {
      changes.cleaned_readable_update = body.new_text.trim()
    }
    if (typeof body.security_issue === 'boolean') changes.security_issue = body.security_issue
    if (typeof body.delay_flag === 'boolean') changes.delay_flag = body.delay_flag
    if (typeof body.access_denied === 'boolean') changes.access_denied = body.access_denied
    if (typeof body.data_quality_issue === 'boolean') changes.data_quality_issue = body.data_quality_issue

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ error: 'Nothing to change' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('visit_updates')
      .update(changes)
      .eq('id', body.update_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Delete an update
export async function DELETE(request) {
  try {
    const body = await request.json()

    if (!body.update_id) {
      return NextResponse.json({ error: 'Missing update id' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('visit_updates')
      .delete()
      .eq('id', body.update_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
