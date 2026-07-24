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
    label: 'Arrived at home base — visit complete',
    visit_status: 'completed',
    time_field: 'arrival_home_base_time',
  },
}

async function parseWithAI(rawText) {
  const systemPrompt = `You are a field operations update parser. You receive free-text updates from field enumerators in English or Arabic. You must return ONLY valid JSON, no other text, no markdown, no code fences.

The JSON must have exactly this structure:
{
  "status": one of "departed" | "arrived" | "in_progress" | "collection_done" | "returning" | "delayed" | "issue" | "unknown",
  "currentLocation": string or null,
  "riskLevel": one of "none" | "low" | "medium" | "high",
  "securityIssue": true or false,
  "delayFlag": true or false,
  "accessDenied": true or false,
  "dataQualityIssue": true or false,
  "cleanedReadableUpdate": string (a clean one-sentence English summary),
  "confidence": number between 0 and 1,
  "needsHumanReview": true or false
}

FLAG DEFINITIONS:
- securityIssue: any security concern — incidents, threats, detention, shooting, closures for security reasons, checkpoint trouble beyond routine waiting.
- delayFlag: the enumerator is delayed or running behind schedule.
- accessDenied: the enumerator was refused entry, turned away, the site was closed, or permission was denied — the visit could not proceed as planned.
- dataQualityIssue: data collection was incomplete or compromised — respondents unavailable, not all beneficiaries reached, tools could not be applied, sampling failed.

STRICT RULES:
- Do NOT invent information that is not in the text. Flags are false unless the text clearly indicates them.
- Only set "status" if the text CLEARLY states a movement or stage change. Otherwise use "unknown".
- NEVER set status to any completion or return state based on future plans or intentions.
- If the text is unclear or you are not confident, set needsHumanReview to true and confidence below 0.5.
- If the text is in Arabic, translate and summarize it in English in cleanedReadableUpdate.
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

// Submit a new update (button event, comment, or both)
export async function POST(request) {
  try {
    const body = await request.json()

    if (!body.visit_id) {
      return NextResponse.json({ error: 'Missing visit' }, { status: 400 })
    }

    const hasEvent = body.status_event && STATUS_EVENTS[body.status_event]
    const hasComment = body.raw_text && body.raw_text.trim().length > 0

    if (!hasEvent && !hasComment) {
      return NextResponse.json(
        { error: 'Choose a status button or write a comment' },
        { status: 400 }
      )
    }

    const results = []

    // ---- 1. Button event (exact, no AI, never flagged) ----
    if (hasEvent) {
      const event = STATUS_EVENTS[body.status_event]
      const now = new Date().toISOString()

      const { data: eventRow, error: eventError } = await supabaseAdmin
        .from('visit_updates')
        .insert({
          visit_id: body.visit_id,
          raw_text: '[BUTTON] ' + event.label,
          parsed_status: event.visit_status,
          cleaned_readable_update: event.label,
          confidence: 1,
          needs_human_review: false,
        })
        .select()
        .single()

      if (eventError) {
        return NextResponse.json({ error: eventError.message }, { status: 400 })
      }
      results.push(eventRow)

      const visitUpdate = {
        current_status: event.visit_status,
        latest_update: event.label,
      }
      if (event.time_field) {
        visitUpdate[event.time_field] = now
      }
      if (body.status_event === 'arrived_at_base') {
        visitUpdate.completed = true
      }

      await supabaseAdmin
        .from('visits')
        .update(visitUpdate)
        .eq('id', body.visit_id)
    }

    // ---- 2. Free-text comment (AI parsed, flags attach to THIS update only) ----
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
        })
        .select()
        .single()

      if (commentError) {
        return NextResponse.json({ error: commentError.message }, { status: 400 })
      }
      results.push(commentRow)

      // Comment only updates the visit's latest text and (carefully) its status
      const visitUpdate = {
        latest_update: ai && ai.cleanedReadableUpdate ? ai.cleanedReadableUpdate : body.raw_text,
      }
      if (!hasEvent && ai && ai.status && ai.status !== 'unknown' && ai.confidence >= 0.7) {
        visitUpdate.current_status = ai.status
      }

      await supabaseAdmin
        .from('visits')
        .update(visitUpdate)
        .eq('id', body.visit_id)
    }

    return NextResponse.json({ updates: results })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Get updates: for one visit (?visit_id=xxx) or all flagged updates (?flagged=true)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const visitId = searchParams.get('visit_id')
    const flaggedOnly = searchParams.get('flagged') === 'true'

    if (flaggedOnly) {
      const { data, error } = await supabaseAdmin
        .from('visit_updates')
        .select('*')
        .or('security_issue.eq.true,delay_flag.eq.true,access_denied.eq.true,data_quality_issue.eq.true')
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      return NextResponse.json({ updates: data })
    }

    if (!visitId) {
      return NextResponse.json({ error: 'Missing visit_id' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('visit_updates')
      .select('*')
      .eq('visit_id', visitId)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ updates: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
