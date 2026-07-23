'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ViewOnlyPage() {
  const [user, setUser] = useState(null)
  const [visits, setVisits] = useState([])
  const [lastRefresh, setLastRefresh] = useState(null)
  const router = useRouter()

  const loadVisits = async () => {
    const res = await fetch('/api/visits')
    const data = await res.json()
    if (data.visits) {
      setVisits(data.visits)
      setLastRefresh(new Date().toLocaleTimeString())
    }
  }

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUser(session.user)
      loadVisits()
    }
    init()

    const interval = setInterval(loadVisits, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString() + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const statusColor = (status) => {
    const colors = {
      planned: '#64748b',
      departed: '#0ea5e9',
      arrived: '#16a34a',
      in_progress: '#16a34a',
      departed_site: '#0ea5e9',
      returned: '#334155',
      delayed: '#f59e0b',
      issue: '#dc2626',
      unknown: '#94a3b8',
    }
    return colors[status] || '#94a3b8'
  }

  const statusLabel = (status) => {
    const labels = {
      planned: 'Planned',
      departed: 'Departed',
      arrived: 'Arrived',
      in_progress: 'In Progress',
      departed_site: 'Left Site',
      returned: 'Returned',
      delayed: 'Delayed',
      issue: 'Issue',
      unknown: 'Unknown',
    }
    return labels[status] || status
  }

  if (!user) return <p style={{ padding: '2rem' }}>Loading...</p>

  const activeVisits = visits.filter(v => !v.completed)
  const flaggedCount = activeVisits.filter(
    v => v.delay_flag || v.return_anomaly_flag || v.overdue_contact_flag
  ).length

  return (
    <main style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>👁️ Field Ops — Live View</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            {lastRefresh ? `Last refreshed: ${lastRefresh} · auto-refreshes every 30s` : 'Loading...'}
          </p>
        </div>
        <button onClick={handleLogout} style={{
          padding: '0.5rem 1rem',
          background: '#64748b',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          Log Out
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{activeVisits.length}</div>
          <div style={{ color: '#666', fontSize: '0.85rem' }}>Active Visits</div>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: flaggedCount > 0 ? '#dc2626' : '#16a34a' }}>
            {flaggedCount}
          </div>
          <div style={{ color: '#666', fontSize: '0.85rem' }}>Flagged</div>
        </div>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{visits.filter(v => v.completed).length}</div>
          <div style={{ color: '#666', fontSize: '0.85rem' }}>Completed</div>
        </div>
      </div>

      {activeVisits.length === 0 && (
        <p style={{ color: '#666' }}>No active visits right now.</p>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {activeVisits.map((v) => (
          <div key={v.id} style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1.25rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            borderLeft: `5px solid ${statusColor(v.current_status)}`
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
              </div>
              <span style={{
                background: statusColor(v.current_status),
                color: 'white',
                padding: '0.25rem 0.75rem',
                borderRadius: '999px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}>
                {statusLabel(v.current_status)}
              </span>
            </div>

            {(v.delay_flag || v.return_anomaly_flag || v.overdue_contact_flag) && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {v.delay_flag && (
                  <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    ⚠️ Delay
                  </span>
                )}
                {v.return_anomaly_flag && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    🔴 Return Anomaly
                  </span>
                )}
                {v.overdue_contact_flag && (
                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    📵 Overdue Contact
                  </span>
                )}
              </div>
            )}

            {v.recent_updates && v.recent_updates.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                {v.recent_updates.map((u, i) => (
                  <div key={u.id} style={{
                    background: '#f8fafc',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    color: '#334155'
                  }}>
                    <div style={{
                      fontSize: '0.75rem',
                      color: '#94a3b8',
                      fontWeight: 600,
                      marginBottom: '0.2rem'
                    }}>
                      {i === 0 ? '💬 Latest update' : '💬 Earlier update'} · 🕐 {formatTime(u.created_at)}
                    </div>
                    {u.cleaned_readable_update || u.raw_text}
                  </div>
                ))}
              </div>
            )}

            <a href={'/visit/' + v.id} style={{
              display: 'inline-block',
              marginTop: '0.75rem',
              color: '#1a56db',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}>
              📜 View full history →
            </a>
          </div>
        ))}
      </div>
    </main>
  )
}
