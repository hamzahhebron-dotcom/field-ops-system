import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// Check that the request comes from the admin
async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const token = authHeader.replace('Bearer ', '')
  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) return null

  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase()
  if (data.user.email.toLowerCase() !== adminEmail) return null

  return data.user
}

// List all users with their roles
export async function GET(request) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const { data: usersData, error: usersError } =
    await supabaseAdmin.auth.admin.listUsers()

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 400 })
  }

  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('*')

  const users = usersData.users.map(u => {
    const roleRow = roles ? roles.find(
      r => r.email.toLowerCase() === u.email.toLowerCase()
    ) : null
    return {
      id: u.id,
      email: u.email,
      role: roleRow ? roleRow.role : 'viewer',
      created_at: u.created_at,
    }
  })

  return NextResponse.json({ users })
}

// Create a new user
export async function POST(request) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.email || !body.password || !body.role) {
    return NextResponse.json(
      { error: 'Missing email, password, or role' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await supabaseAdmin
    .from('user_roles')
    .upsert({ email: body.email.toLowerCase(), role: body.role })

  return NextResponse.json({ user: data.user })
}

// Update a user's role
export async function PATCH(request) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.email || !body.role) {
    return NextResponse.json(
      { error: 'Missing email or role' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin
    .from('user_roles')
    .upsert({ email: body.email.toLowerCase(), role: body.role })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}

// Delete a user
export async function DELETE(request) {
  const admin = await verifyAdmin(request)
  if (!admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await request.json()

  if (!body.user_id || !body.email) {
    return NextResponse.json(
      { error: 'Missing user id or email' },
      { status: 400 }
    )
  }

  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase()
  if (body.email.toLowerCase() === adminEmail) {
    return NextResponse.json(
      { error: 'You cannot delete the admin account' },
      { status: 400 }
    )
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(body.user_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('email', body.email.toLowerCase())

  return NextResponse.json({ success: true })
}
