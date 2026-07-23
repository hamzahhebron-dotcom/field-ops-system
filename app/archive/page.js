'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ArchivePage() {
  const [user, setUser] = useState(null)
  const [visits, setVisits] = useState([])
  const [message, setMessage] = useState('')
  const router = useRouter()

  const loadVisits = async () => {
    const res = await fetch('/api/visits')
    const data = await res.json()
    if (data.visits) {
      setVisits(data.visits)
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const check = await fetch('/api/whoami', {
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      })
      const me = await check.json()
      if (me.role !== 'editor') {
        router.push('/view')
        return
      }
      setUser(session.user)
      loadVisits()
    }
    init()
  }, [])

  const handleUnarchive = async (visitId) => {
    const res = await fetch('/api/visits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_id: visitId, archived: false }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('✅ Visit restored to dashboard')
      loadVisits()
    }
  }

  const handleDelete = async (visitId, label) => {
    if (!confirm(`Permanently delete "${label}"?\n\nThis deletes the visit AND all its updates forever. This cannot be undone.`)) {
      return
    }

    const res = await fetch('/api/visits', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_id: visitId }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('🗑️ Visit permanently deleted')
      loadVisits()
    }
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString() + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (!user) return <p style={{ padding: '2rem' }}>Loading...</p>

  const archivedVisits = visits.filter(v => v.archived)

  return (
    <main style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '0.5rem'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>📦 Archived Visits</h1>
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

      {message && (
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>
      )}

      {archivedVisits.length === 0 && (
        <p style={{ color: '#666' }}>
          No archived visits yet. Completed visits can be archived from the dashboard.
        </p>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {archivedVisits.map((v) => (
          <div key={v.id} style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1.25rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            borderLeft: '5px solid #94a3b8'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                  {v.activity_id} — {v.enumerator_name}
                </div>
                <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.15rem' }}>
                  📍 {v.target_location}
                </div>
                {v.arrival_home_base_time && (
                  <div style={{ color: '#334155', fontSize: '0.85rem', marginTop: '0.3rem', fontWeight: 600 }}>
                    ✔️ Completed: {formatTime(v.arrival_home_base_time)}
                  </div>
                )}
              </div>
              <span style={{
                background: '#94a3b8',
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                📦 Archived
              </span>
            </div>

            <div style={{
              marginTop: '0.9rem',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <a href={'/visit/' + v.id} style={{
                color: '#1a56db',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.85rem'
              }}>
                📜 View full history →
              </a>
              <button
                onClick={() => handleUnarchive(v.id)}
                style={{
                  padding: '0.35rem 0.8rem',
                  background: '#0ea5e9',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                ↩️ Restore
              </button>
              <button
                onClick={() => handleDelete(v.id, v.activity_id + ' — ' + v.enumerator_name)}
                style={{
                  padding: '0.35rem 0.8rem',
                  background: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}
              >
                🗑️ Delete Permanently
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
