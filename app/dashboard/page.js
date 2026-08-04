'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import { formatTimeInRegion, regionLabel } from '../../lib/regions'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [visits, setVisits] = useState([])
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [filter, setFilter] = useState('all')
  const [lastRefresh, setLastRefresh] = useState(null)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const loadData = async () => {
    const [vRes, fRes] = await Promise.all([
      fetch('/api/visits'),
      fetch('/api/updates?flagged=true'),
    ])
    const vData = await vRes.json()
    const fData = await fRes.json()

    if (vData.visits) {
      setVisits(vData.visits)
      setLastRefresh(new Date().toLocaleTimeString())

      if (fData.updates) {
        const visibleIds = vData.visits.filter(v => !v.archived).map(v => v.id)
        setFlaggedCount(fData.updates.filter(u => visibleIds.includes(u.visit_id)).length)
      }
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
      loadData()
    }
    init()

    const interval = setInterval(loadData, 30000)
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
      loadData()
    }
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

  const updateFlags = (u) => {
    const flags = []
    if (u.security_issue) flags.push({ label: '🔴 Security', bg: '#fee2e2', color: '#991b1b' })
    if (u.delay_flag) flags.push({ label: '⚠️ Delay', bg: '#fef3c7', color: '#92400e' })
    if (u.access_denied) flags.push({ label: '🚧 Access Denied', bg: '#f3e8ff', color: '#6b21a8' })
    if (u.data_quality_issue) flags.push({ label: '📉 Data Quality', bg: '#e0f2fe', color: '#075985' })
    return flags
  }

  if (!user) return <p style={{ padding: '2rem' }}>Loading...</p>

  const visibleVisits = visits.filter(v => !v.archived)
  const plannedVisits = visibleVisits.filter(v => !v.completed && v.current_status === 'planned')
  const activeVisits = visibleVisits.filter(v => !v.completed && v.current_status !== 'planned')
  const completedVisits = visibleVisits.filter(v => v.completed)

  const FILTERS = [
    { key: 'all', label: `All (${visibleVisits.length})` },
    { key: 'planned', label: `🗓 Planned (${plannedVisits.length})` },
    { key: 'active', label: `🟢 Active (${activeVisits.length})` },
    { key: 'completed', label: `✔️ Completed (${completedVisits.length})` },
  ]

  const filteredVisits =
    filter === 'planned' ? plannedVisits :
    filter === 'active' ? activeVisits :
    filter === 'completed' ? completedVisits :
    [...plannedVisits, ...activeVisits, ...completedVisits]

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
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>
            👤 {v.enumerator_name}
          </div>
          <div style={{ color: '#475569', fontSize: '0.95rem', marginTop: '0.2rem', fontWeight: 600 }}>
            📍 {v.target_location}
            {v.region && (
              <span style={{ fontWeight: 500, color: '#64748b' }}> — {regionLabel(v.region)}</span>
            )}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            ID: {v.activity_id}
          </div>
          {v.completed && v.arrival_home_base_time && (
            <div style={{ color: '#334155', fontSize: '0.85rem', marginTop: '0.3rem', fontWeight: 600 }}>
              ✔️ Completed: {formatTimeInRegion(v.arrival_home_base_time, v.region)}
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

      {v.recent_updates && v.recent_updates.length > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
          {v.recent_updates.map((u, i) => {
            const flags = updateFlags(u)
            return (
              <div key={u.id} style={{
                background: '#f8fafc',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                color: '#334155',
                borderLeft: flags.length > 0
                  ? (u.security_issue ? '3px solid #dc2626' : '3px solid #f59e0b')
                  : 'none'
              }}>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  fontWeight: 600,
                  marginBottom: '0.2rem'
                }}>
                  {i === 0 ? '💬 Latest update' : '💬 Earlier update'} · 🕐 {formatTimeInRegion(u.event_time || u.created_at, v.region)}
                </div>
                {u.cleaned_readable_update || u.raw_text}
                {flags.length > 0 && (
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {flags.map(f => (
                      <span key={f.label} style={{
                        background: f.bg,
                        color: f.color,
                        padding: '0.1rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600
                      }}>
                        {f.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {!v.completed && (
          <a href={'/input?visit=' + v.id} style={{
            padding: '0.35rem 0.8rem',
            background: '#16a34a',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.85rem'
          }}>
            ➕ Add Update
          </a>
        )}
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
        <a href="/flagged" style={{
          background: 'white',
          padding: '1rem',
          borderRadius: '10px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          textDecoration: 'none',
          display: 'block',
          border: flaggedCount > 0 ? '1px solid #fecaca' : '1px solid transparent'
        }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: flaggedCount > 0 ? '#dc2626' : '#16a34a' }}>
            {flaggedCount}
          </div>
          <div style={{ color: '#666', fontSize: '0.85rem' }}>🚩 Flagged Events →</div>
        </a>
        <div style={{ background: 'white', padding: '1rem', borderRadius: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{completedVisits.length}</div>
          <div style={{ color: '#666', fontSize: '0.85rem' }}>Completed</div>
        </div>
      </div>

      {message && (
        <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>
      )}

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {FILTERS.map(f => (
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

      {filteredVisits.length === 0 && (
        <p style={{ color: '#666' }}>No visits in this view.</p>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {filteredVisits.map(renderCard)}
      </div>
    </main>
  )
}
