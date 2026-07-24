'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { formatTimeInRegion, regionLabel } from '../../lib/regions'

export default function FlaggedPage() {
  const [user, setUser] = useState(null)
  const [updates, setUpdates] = useState([])
  const [visits, setVisits] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)

      const [uRes, vRes] = await Promise.all([
        fetch('/api/updates?flagged=true'),
        fetch('/api/visits'),
      ])
      const uData = await uRes.json()
      const vData = await vRes.json()

      if (uData.updates) setUpdates(uData.updates)
      if (vData.visits) setVisits(vData.visits)
      setLoading(false)
    }
    init()
  }, [])

  const visitById = (id) => visits.find(v => v.id === id)

  const FLAG_TYPES = [
    { key: 'all', label: 'All flags' },
    { key: 'security_issue', label: '🔴 Security' },
    { key: 'delay_flag', label: '⚠️ Delay' },
    { key: 'access_denied', label: '🚧 Access Denied' },
    { key: 'data_quality_issue', label: '📉 Data Quality' },
  ]

  const filtered = updates.filter(u => {
    if (filter === 'all') return true
    return u[filter] === true
  })

  if (loading || !user) return <p style={{ padding: '2rem' }}>Loading...</p>

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
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>🚩 Flagged Events</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="/dashboard" style={{
            padding: '0.5rem 1rem',
            background: '#1a56db',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}>
            ← Dashboard
          </a>
          <a href="/view" style={{
            padding: '0.5rem 1rem',
            background: '#64748b',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}>
            ← Live View
          </a>
        </div>
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {FLAG_TYPES.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '0.4rem 0.9rem',
              background: filter === f.key ? '#1a56db' : 'white',
              color: filter === f.key ? 'white' : '#334155',
              border: '1px solid ' + (filter === f.key ? '#1a56db' : '#e2e8f0'),
              borderRadius: '999px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: '#666' }}>No flagged events. All clear. ✅</p>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {filtered.map((u) => {
          const v = visitById(u.visit_id)
          return (
            <div key={u.id} style={{
              background: 'white',
              borderRadius: '10px',
              padding: '1.25rem',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              borderLeft: u.security_issue
                ? '5px solid #dc2626'
                : u.access_denied
                  ? '5px solid #9333ea'
                  : u.delay_flag
                    ? '5px solid #f59e0b'
                    : '5px solid #0ea5e9'
            }}>
              {/* Which visit this came from */}
              <div style={{
                fontSize: '0.85rem',
                color: '#64748b',
                fontWeight: 600,
                marginBottom: '0.4rem'
              }}>
                {v
                  ? `${v.activity_id} — ${v.enumerator_name} · 📍 ${v.target_location}`
                  : 'Visit deleted'}
              </div>

              {/* Timestamp */}
              <div style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                fontWeight: 600,
                marginBottom: '0.4rem'
              }}>
                🕐 {formatTimeInRegion(u.created_at, v ? v.region : null)}
                {v && v.region ? ' · ' + regionLabel(v.region) : ''}
              </div>

              {/* The flagged update itself */}
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                {u.cleaned_readable_update || u.raw_text}
              </p>

              {/* Flags on this event */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                {u.security_issue && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    🔴 Security
                  </span>
                )}
                {u.delay_flag && (
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    ⚠️ Delay
                  </span>
                )}
                {u.access_denied && (
                  <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    🚧 Access Denied
                  </span>
                )}
                {u.data_quality_issue && (
                  <span style={{ background: '#e0f2fe', color: '#075985', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    📉 Data Quality
                  </span>
                )}
              </div>

              {v && (
                <a href={'/visit/' + v.id} style={{
                  color: '#1a56db',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '0.85rem'
                }}>
                  📜 View full visit log →
                </a>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
