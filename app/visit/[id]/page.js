'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function VisitHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const [visit, setVisit] = useState(null)
  const [updates, setUpdates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      // Load all visits and find this one
      const vRes = await fetch('/api/visits')
      const vData = await vRes.json()
      if (vData.visits) {
        const found = vData.visits.find(v => v.id === params.id)
        setVisit(found || null)
      }

      // Load all updates for this visit
      const uRes = await fetch('/api/updates?visit_id=' + params.id)
      const uData = await uRes.json()
      if (uData.updates) {
        setUpdates(uData.updates)
      }

      setLoading(false)
    }
    init()
  }, [])

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString() + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>

  if (!visit) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Visit not found.</p>
        <a href="/dashboard">← Back to Dashboard</a>
      </main>
    )
  }

  return (
    <main style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <a href="/dashboard" style={{
          color: '#1a56db',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          ← Dashboard
        </a>
        <a href="/view" style={{
          color: '#64748b',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          ← Live View
        </a>
      </div>

      {/* Visit header */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        marginBottom: '1.5rem'
      }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>
          {visit.activity_id} — {visit.enumerator_name}
        </h1>
        <p style={{ color: '#666', margin: '0.4rem 0 0' }}>
          📍 {visit.target_location}
        </p>
        {visit.planned_departure_time && (
          <p style={{ color: '#666', margin: '0.3rem 0 0', fontSize: '0.9rem' }}>
            🕐 Planned departure: {formatTime(visit.planned_departure_time)}
          </p>
        )}
      </div>

      {/* Updates timeline */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
        📜 Update History ({updates.length})
      </h2>

      {updates.length === 0 && (
        <p style={{ color: '#666' }}>No updates submitted yet for this visit.</p>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {updates.map((u, i) => (
          <div key={u.id} style={{
            background: 'white',
            padding: '1rem 1.25rem',
            borderRadius: '10px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            borderLeft: u.security_issue
              ? '4px solid #dc2626'
              : u.delay_flag
                ? '4px solid #f59e0b'
                : '4px solid #e2e8f0'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
              gap: '0.3rem'
            }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>
                Update #{i + 1}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                🕐 {formatTime(u.created_at)}
              </span>
            </div>

            {u.cleaned_readable_update && (
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>
                {u.cleaned_readable_update}
              </p>
            )}

            <p style={{
              margin: 0,
              fontSize: '0.85rem',
              color: '#64748b',
              background: '#f8fafc',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px'
            }}>
              Raw: "{u.raw_text}"
            </p>

            {(u.security_issue || u.delay_flag || u.needs_human_review) && (
              <div style={{ marginTop: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
                {u.needs_human_review && (
                  <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                    👀 Needs Review
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  )
}
