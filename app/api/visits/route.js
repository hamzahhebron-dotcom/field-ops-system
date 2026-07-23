import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// Create a new visit
export async function POST(request) {
  try {
    const body = await request.json()

    const { data, error } = await supabaseAdmin
      .from('visits')
      .insert({
        activity_id: body.activity_id,
        enumerator_name: body.enumerator_name,
        target_location: body.target_location,
        planned_departure_time: body.planned_departure_time,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ visit: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Get all visits (each with its 2 latest updates)
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('visits')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Fetch all updates, newest first
    const { data: allUpdates } = await supabaseAdmin
      .from('visit_updates')
      .select('id, visit_id, raw_text, cleaned_readable_update, created_at')
      .order('created_at', { ascending: false })

    // Attach the 2 most recent updates to each visit
    const visits = data.map(v => {
      const updatesForVisit = (allUpdates || []).filter(
        u => u.visit_id === v.id
      )
      return {
        ...v,
        recent_updates: updatesForVisit.slice(0, 2),
      }
    })

    return NextResponse.json({ visits })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
