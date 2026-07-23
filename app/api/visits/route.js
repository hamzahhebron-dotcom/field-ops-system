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

// Get all visits
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('visits')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ visits: data })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
