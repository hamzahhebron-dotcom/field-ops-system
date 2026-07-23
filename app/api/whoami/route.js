import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !data.user) {
      return NextResponse.json({ error: 'Not logged in' }, { status: 401 })
    }

    const email = data.user.email.toLowerCase()

    // Admin is always an editor
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase()
    if (email === adminEmail) {
      return NextResponse.json({ email, role: 'editor', isAdmin: true })
    }

    const { data: roleRow } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('email', email)
      .single()

    return NextResponse.json({
      email,
      role: roleRow ? roleRow.role : 'viewer',
      isAdmin: false,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
