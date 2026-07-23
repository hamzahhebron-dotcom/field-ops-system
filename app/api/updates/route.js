import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

async function parseWithAI(rawText) {
  const systemPrompt = `You are a field operations update parser. You receive free-text updates from field enumerators in English or Arabic. You must return ONLY valid JSON, no other text, no markdown, no code fences.

The JSON must have exactly this structure:
{
  "activityId": string or null,
  "enumeratorName": string or null,
  "status": one of "departed" | "arrived" | "in_progress" | "departed_site" | "returned" | "delayed" | "issue" | "unknown",
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

// Submit a new update
export async function POST(request) {
  try {
    const body = await request.json()

    if (!body.visit_id || !body.raw_text) {
      return NextResponse.json(
        { error: 'Missing visit or update text' },
        { status: 400 }
      )
    }

    // Try AI parsing — if it fails, still save the raw text
    let ai = null
    let aiFailed = false
    try {
      ai = await parseWithAI(body.raw_text)
    } catch (e) {
      aiFailed = true
    }

    const { data, error } = await supabaseAdmin
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

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update the visit with the latest status
    const visitUpdate = {
      latest_update: ai && ai.cleanedReadableUpdate ? ai.cleanedReadableUpdate : body.raw_text,
    }
    if (ai && ai.status && ai.status !== 'unknown') {
      visitUpdate.current_status = ai.status
    }
    if (ai && ai.delayFlag) {
      visitUpdate.delay_flag = true
    }

    await supabaseAdmin
      .from('visits')
      .update(visitUpdate)
      .eq('id', body.visit_id)

    return NextResponse.json({
      update: data,
      aiParsed: !aiFailed,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
