'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

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

  const formatTime = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString() + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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

  if (loading) return <p style={{ padding: '2rem' }}>Loading...</p>

  if (!visit) {
    return (
      <main style={{ padding: '2rem' }}>
        <p>Visit not found.</p>
        <a href="/dashboard">← Back to Dashboard</a>
      </main>
    )
  }

  const timeline = [
    { label: 'Planned departure', time: visit.planned_departure_time },
    { label: 'Actual departure', time: visit.actual_departure_time },
    { label: 'Arrived at destination', time: visit.arrival_time_at_destination },
    { label: 'Departed destination', time: visit.departure_from_destination },
    { label: 'Arrived at home base', time: visit.arrival_home_base_time },
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

      {/* Report header */}
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
          {visit.activity_id} — {visit.enumerator_name}
        </h1>
        <p style={{ color: '#666', margin: '0.4rem 0 0' }}>
          📍 {visit.target_location}
        </p>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.95rem' }}>
          <strong>Status:</strong> {visit.completed ? '✔️ Completed' : statusLabel(visit.current_status)}
          {visit.archived ? ' · 📦 Archived' : ''}
        </p>
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
          Report generated: {formatTime(new Date().toISOString())}
        </p>
      </div>

      {/* Movement timeline */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        marginBottom: '1.5rem'
      }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>🕐 Movement Timeline</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <tbody>
            {timeline.map((t) => (
              <tr key={t.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '0.5rem 0', color: '#475569', fontWeight: 600 }}>
                  {t.label}
                </td>
                <td style={{ padding: '0.5rem 0', textAlign: 'right', color: t.time ? '#0f172a' : '#cbd5e1' }}>
                  {formatTime(t.time)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Update log */}
      <div style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '10px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
      }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>
          📜 Update Log ({updates.length})
        </h2>

        {updates.length === 0 && (
          <p style={{ color: '#666' }}>No updates recorded for this visit.</p>
        )}

        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {updates.map((u, i) => (
            <div key={u.id} style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              background: '#f8fafc',
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
                marginBottom: '0.4rem',
                flexWrap: 'wrap',
                gap: '0.3rem'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#475569' }}>
                  #{i + 1}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  {formatTime(u.created_at)}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '0.95rem' }}>
                {u.cleaned_readable_update || u.raw_text}
              </p>

              {u.raw_text && u.cleaned_readable_update && u.raw_text !== u.cleaned_readable_update && !u.raw_text.startsWith('[BUTTON]') && (
                <p style={{
                  margin: '0.4rem 0 0',
                  fontSize: '0.8rem',
                  color: '#94a3b8'
                }}>
                  Original: "{u.raw_text}"
                </p>
              )}

              {(u.security_issue || u.delay_flag || u.needs_human_review) && (
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
