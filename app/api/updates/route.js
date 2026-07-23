import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// The 6 button events and what they mean
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
    visit_status: 'returned',
    time_field: 'arrival_home_base_time',
  },
}

async function parseWithAI(rawText) {
  const systemPrompt = `You are a field operations update parser. You receive free-text updates from field enumerators in English or Arabic. You must return ONLY valid JSON, no other text, no markdown, no code fences.

The JSON must have exactly this structure:
{
  "activityId": string or null,
  "enumeratorName": string or null,
  "status": one of "departed" | "arrived" | "in_progress" | "collection_done" | "returning" | "returned" | "delayed" | "issue" | "unknown",
  "currentLocation": string or null,
  "updateTime": ISO 8601 datetime string or null,
  "riskLevel": one of "none" | "low" | "medium" | "high",
  "securityIssue": true or false,
  "delayFlag": true or false,
  "nextCheckIn": ISO 8601 datetime string or null,
  "cleanedReadableUpdate": string (a clean one-sentence English summary),
  "confidence": number between 0 and 1,
  "needsHumanReview": true or false
}

STRICT RULES:
- Do NOT invent information that is not in the text. Use null for anything not mentioned.
- Only set "status" if the text CLEARLY states a movement or stage change. Otherwise use "unknown".
- If the text is unclear, contradictory, or you are not confident, set needsHumanReview to true and confidence below 0.5.
- If the text is in Arabic, translate and summarize it in English in cleanedReadableUpdate.
- If a time is mentioned without a date, assume today's date: ${new Date().toISOString().split('T')[0]}.
- If any security concern is mentioned (checkpoints, incidents, threats, detention, shooting, closure), set securityIssue to true and riskLevel to at least "medium".
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

    // ---- 1. Handle button event (no AI needed — it's exact) ----
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

      // Update the visit record
      const visitUpdate = {
        current_status: event.visit_status,
        latest_update: event.label,
      }
      if (event.time_field) {
        visitUpdate[event.time_field] = now
      }
      // Arriving home closes the visit
      if (body.status_event === 'arrived_at_base') {
        visitUpdate.completed = true
      }

      await supabaseAdmin
        .from('visits')
        .update(visitUpdate)
        .eq('id', body.visit_id)
    }

    // ---- 2. Handle free-text comment (AI parsed) ----
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
          parsed_update_time: ai ? ai.updateTime : null,
          parsed_risk_level: ai ? ai.riskLevel : null,
          security_issue: ai ? ai.securityIssue : false,
          delay_flag: ai ? ai.delayFlag : false,
          next_check_in_at: ai ? ai.nextCheckIn : null,
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

      // Comment only updates visit status if AI is confident AND no button was pressed
      const visitUpdate = {
        latest_update: ai && ai.cleanedReadableUpdate ? ai.cleanedReadableUpdate : body.raw_text,
      }
      if (!hasEvent && ai && ai.status && ai.status !== 'unknown' && ai.confidence >= 0.7) {
        visitUpdate.current_status = ai.status
      }
      if (ai && ai.delayFlag) {
        visitUpdate.delay_flag = true
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

// Get all updates for a visit (?visit_id=xxx), oldest first
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const visitId = searchParams.get('visit_id')

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
