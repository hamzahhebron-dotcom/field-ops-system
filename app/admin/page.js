'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const [users, setUsers] = useState([])
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState('viewer')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const router = useRouter()

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? session.access_token : null
  }

  const loadUsers = async () => {
    const token = await getToken()
    if (!token) {
      router.push('/login')
      return
    }

    const res = await fetch('/api/admin', {
      headers: { 'Authorization': `Bearer ${token}` },
    })

    if (res.status === 403) {
      router.push('/dashboard')
      return
    }

    const data = await res.json()
    if (data.users) {
      setUsers(data.users)
      setAuthorized(true)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleAddUser = async () => {
    if (!newEmail || !newPassword) {
      setMessage('❌ Enter email and password')
      return
    }
    setLoading(true)
    setMessage('')

    const token = await getToken()
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: newEmail,
        password: newPassword,
        role: newRole,
      }),
    })

    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('✅ User added: ' + newEmail)
      setNewEmail('')
      setNewPassword('')
      setNewRole('viewer')
      loadUsers()
    }
    setLoading(false)
  }

  const handleChangeRole = async (email, currentRole) => {
    const nextRole = currentRole === 'editor' ? 'viewer' : 'editor'
    const token = await getToken()

    const res = await fetch('/api/admin', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ email, role: nextRole }),
    })

    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage(`✅ ${email} is now ${nextRole}`)
      loadUsers()
    }
  }

  const handleDelete = async (userId, email) => {
    if (!confirm(`Remove ${email}? They will no longer be able to log in.`)) return

    const token = await getToken()
    const res = await fetch('/api/admin', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: userId, email }),
    })

    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('✅ Removed ' + email)
      loadUsers()
    }
  }

  if (!authorized) return <p style={{ padding: '2rem' }}>Loading...</p>

  const inputStyle = {
    padding: '0.6rem 0.8rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '0.95rem',
    boxSizing: 'border-box'
  }

  return (
    <main style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>👤 User Management</h1>
        <a href="/dashboard" style={{
          padding: '0.5rem 1rem',
          background: '#1a56db',
          color: 'white',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          ← Back to Dashboard
        </a>
      </div>

      {/* Add user card */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>➕ Add New User</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            type="email"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={{ ...inputStyle, flex: '2', minWidth: '180px' }}
          />
          <input
            type="text"
            placeholder="Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ ...inputStyle, flex: '2', minWidth: '140px' }}
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            style={{ ...inputStyle, flex: '1', minWidth: '110px', background: 'white' }}
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button
            onClick={handleAddUser}
            disabled={loading}
            style={{
              padding: '0.6rem 1.2rem',
              background: loading ? '#aaa' : '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {message && (
        <p style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>{message}</p>
      )}

      {/* Users list */}
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {users.map((u) => (
          <div key={u.id} style={{
            background: 'white',
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>{u.email}</div>
              <span style={{
                display: 'inline-block',
                marginTop: '0.3rem',
                background: u.role === 'editor' ? '#dbeafe' : '#f1f5f9',
                color: u.role === 'editor' ? '#1e40af' : '#475569',
                padding: '0.15rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                {u.role === 'editor' ? '✏️ Editor' : '👁️ Viewer'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => handleChangeRole(u.email, u.role)}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Make {u.role === 'editor' ? 'Viewer' : 'Editor'}
              </button>
              <button
                onClick={() => handleDelete(u.id, u.email)}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
