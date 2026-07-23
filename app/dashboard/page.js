'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [visits, setVisits] = useState([])
  const [lastRefresh, setLastRefresh] = useState(null)
  const [message, setMessage] = useState('')
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

    const interval = setInterval(loadVisits, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleArchive = async (visitId) => {
    const res = await fetch('/api/visits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_id: visitId, archived: true }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('✅ Visit archived')
      loadVisits()
    }
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
      collection_done: '#0d9488',
      returning: '#0ea5e9',
      completed: '#334155',
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
      in_progress: 'Collection In Progress',
      collection_done: 'Collection Finished',
      returning: 'Returning to Base',
      completed: 'Completed',
      delayed: 'Delayed',
      issue: 'Issue',
      unknown: 'Unknown',
    }
    return labels[status] || status
  }

  if (!user) return <p style={{ padding: '2rem' }}>Loading...</p>

  const visibleVisits = visits.filter(v => !v.archived)
  const activeVisits = visibleVisits.filter(v => !v.completed)
  const completedVisits = visibleVisits.filter(v => v.completed)
  const flaggedCount = activeVisits.filter(
    v => v.delay_flag || v.return_anomaly_flag || v.overdue_contact_flag
  ).length

  const renderCard = (v) => (
    <div key={v.id} style={{
      background: 'white',
      borderRadius: '10px',
      padding: '1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      borderLeft: `5px solid ${v.completed ? '#334155' : statusColor(v.current_status)}`,
      opacity: v.completed ? 0.92 : 1
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
          {v.completed && v.arrival_home_base_time && (
            <div style={{ color: '#334155', fontSize: '0.85rem', marginTop: '0.3rem', fontWeight: 600 }}>
              ✔️ Completed: {formatTime(v.arrival_home_base_time)}
            </div>
          )}
        </div>
        <span style={{
          background: v.completed ? '#334155' : statusColor(v.current_status),
          color: 'white',
          padding: '0.25rem 0.75rem',
          borderRadius: '999px',
          fontSize: '0.8rem',
          fontWeight: 600
        }}>
          {v.completed ? '✔️ Completed' : statusLabel(v.current_status)}
        </span>
      </div>

      {!v.completed && (v.delay_flag || v.return_anomaly_flag || v.overdue_contact_flag) && (
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

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <a href={'/visit/' + v.id} style={{
          color: '#1a56db',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.85rem'
        }}>
          📜 View full history →
        </a>
        {v.completed && (
          <button
            onClick={() => handleArchive(v.id)}
            style={{
              padding: '0.35rem 0.8rem',
              background: '#64748b',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            📦 Archive
          </button>
        )}
      </div>
    </div>
  )

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
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>🛡️ Field Ops Dashboard</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            {lastRefresh ? `Last refreshed: ${lastRefresh} · auto-refreshes every 30s` : 'Loading...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <a href="/create-visit" style={{
            padding: '0.5rem 1rem',
            background: '#1a56db',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}>
            + New Visit
          </a>
          <a href="/input" style={{
            padding: '0.5rem 1rem',
            background: '#16a34a',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}>
            📡 Submit Update
          </a>
          <a href="/archive" style={{
            padding: '0.5rem 1rem',
            background: '#64748b',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}>
            📦 Archive
          </a>
          <button onClick={handleLogout} style={{
            padding: '0.5rem 1rem',
            background: '#e53e3e',
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
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{completedVisits.length}</div>
          <div style={{ color: '#666', fontSize: '0.85rem' }}>Completed</div>
        </div>
      </div>

      {message && (
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>
      )}

      {/* Active visits */}
      <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>🟢 Active Visits</h2>
      {activeVisits.length === 0 && (
        <p style={{ color: '#666' }}>No active visits.</p>
      )}
      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        {activeVisits.map(renderCard)}
      </div>

      {/* Completed visits */}
      {completedVisits.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>✔️ Completed Visits</h2>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {completedVisits.map(renderCard)}
          </div>
        </>
      )}
    </main>
  )
}
