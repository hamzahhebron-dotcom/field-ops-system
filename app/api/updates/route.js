import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

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

    // Save the raw update (AI parsing will be added in the next step)
    const { data, error } = await supabaseAdmin
      .from('visit_updates')
      .insert({
        visit_id: body.visit_id,
        raw_text: body.raw_text,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Also store the latest update text on the visit itself
    await supabaseAdmin
      .from('visits')
      .update({ latest_update: body.raw_text })
      .eq('id', body.visit_id)

    return NextResponse.json({ update: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
