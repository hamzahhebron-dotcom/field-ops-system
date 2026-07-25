'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { formatTimeInRegion, regionLabel } from '../../../lib/regions'

export default function VisitReportPage() {
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

      const vRes = await fetch('/api/visits')
      const vData = await vRes.json()
      if (vData.visits) {
        const found = vData.visits.find(v => v.id === params.id)
        setVisit(found || null)
      }

      const uRes = await fetch('/api/updates?visit_id=' + params.id)
      const uData = await uRes.json()
      if (uData.updates) {
        setUpdates(uData.updates)
      }

      setLoading(false)
    }
    init()
  }, [])

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

  const entryIcon = (u) => {
    if (!u.raw_text || !u.raw_text.startsWith('[BUTTON]')) {
      if (u.security_issue) return '🔴'
      if (u.access_denied) return '🚧'
      if (u.delay_flag) return '⚠️'
      if (u.data_quality_issue) return '📉'
      return '💬'
    }
    if (u.raw_text.includes('Departed to location')) return '🚗'
    if (u.raw_text.includes('Arrived at location')) return '📍'
    if (u.raw_text.includes('collection started')) return '📋'
    if (u.raw_text.includes('collection finished')) return '✅'
    if (u.raw_text.includes('Departing to home base')) return '🏠'
    if (u.raw_text.includes('home base — visit complete')) return '🎯'
    return '🔘'
  }

  const isButtonEntry = (u) => u.raw_text && u.raw_text.startsWith('[BUTTON]')

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>

  if (!visit) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Visit not found.</p>
        <a href="/dashboard">← Back to Dashboard</a>
      </main>
    )
  }

  const ft = (iso) => formatTimeInRegion(iso, visit.region)

  const logEntries = [
    {
      id: 'created',
      icon: '🗓',
      time: visit.created_at,
      text: 'Visit created',
      isSystem: true,
    },
    ...updates.map(u => ({
      id: u.id,
      icon: entryIcon(u),
      time: u.created_at,
      text: u.cleaned_readable_update || u.raw_text,
      original: !isButtonEntry(u) && u.raw_text !== u.cleaned_readable_update ? u.raw_text : null,
      security: u.security_issue,
      delay: u.delay_flag,
      access: u.access_denied,
      quality: u.data_quality_issue,
      review: u.needs_human_review,
      isSystem: isButtonEntry(u),
    })),
  ]

  return (
    <main style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>

      {/* Toolbar — hidden when printing */}
      <div className="no-print" style={{
        marginBottom: '1rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
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
        <button
          onClick={() => window.print()}
          style={{
            padding: '0.5rem 1rem',
            background: '#1a56db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.9rem'
          }}
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Visit info — enumerator first */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        marginBottom: '1.5rem'
      }}>
        <p style={{
          margin: '0 0 0.5rem',
          fontSize: '0.8rem',
          color: '#94a3b8',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          Field Visit Report
        </p>
        <h1 style={{ margin: 0, fontSize: '1.4rem' }}>
          👤 {visit.enumerator_name}
        </h1>
        <p style={{ color: '#475569', margin: '0.4rem 0 0', fontWeight: 600 }}>
          📍 {visit.target_location}
          {visit.region && (
            <span style={{ fontWeight: 500, color: '#64748b' }}> — {regionLabel(visit.region)}</span>
          )}
        </p>
        <p style={{ color: '#94a3b8', margin: '0.3rem 0 0', fontSize: '0.85rem' }}>
          ID: {visit.activity_id}
        </p>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.95rem' }}>
          <strong>Planned start:</strong> {ft(visit.planned_departure_time)}
        </p>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.95rem' }}>
          <strong>Status:</strong> {visit.completed ? '✔️ Completed' : statusLabel(visit.current_status)}
          {visit.archived ? ' · 📦 Archived' : ''}
        </p>
        {visit.region && (
          <p style={{ margin: '0.6rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
            All times shown in local time · {regionLabel(visit.region)}
          </p>
        )}
      </div>

      {/* Activity Log */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>
          📜 Activity Log
        </h2>

        <div>
          {logEntries.map((entry, i) => (
            <div key={entry.id} style={{
              display: 'flex',
              gap: '0.9rem',
              paddingBottom: i === logEntries.length - 1 ? 0 : '1.1rem',
              position: 'relative'
            }}>
              {i !== logEntries.length - 1 && (
                <div style={{
                  position: 'absolute',
                  left: '0.72rem',
                  top: '1.6rem',
                  bottom: 0,
                  width: '2px',
                  background: '#e2e8f0'
                }} />
              )}

              <div style={{
                width: '1.5rem',
                height: '1.5rem',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.95rem',
                zIndex: 1,
                background: 'white'
              }}>
                {entry.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  fontWeight: 600,
                  marginBottom: '0.15rem'
                }}>
                  {ft(entry.time)}
                </div>
                <div style={{
                  fontSize: '0.95rem',
                  color: entry.isSystem ? '#475569' : '#0f172a',
                  fontWeight: entry.isSystem ? 600 : 400
                }}>
                  {entry.text}
                </div>
                {entry.original && (
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    marginTop: '0.2rem'
                  }}>
                    Original: "{entry.original}"
                  </div>
                )}
                {(entry.security || entry.delay || entry.access || entry.quality || entry.review) && (
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {entry.security && (
                      <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        🔴 Security
                      </span>
                    )}
                    {entry.delay && (
                      <span style={{ background: '#fef3c7', color: '#92400e', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        ⚠️ Delay
                      </span>
                    )}
                    {entry.access && (
                      <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        🚧 Access Denied
                      </span>
                    )}
                    {entry.quality && (
                      <span style={{ background: '#e0f2fe', color: '#075985', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        📉 Data Quality
                      </span>
                    )}
                    {entry.review && (
                      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        👀 Needs Review
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Print styling */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </main>
  )
}
