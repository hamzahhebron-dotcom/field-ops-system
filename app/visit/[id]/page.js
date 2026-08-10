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
  const [isEditor, setIsEditor] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [flagEditorFor, setFlagEditorFor] = useState(null)
  const [editPanelFor, setEditPanelFor] = useState(null)
  const [editText, setEditText] = useState('')
  const [editTime, setEditTime] = useState('')

  const loadData = async () => {
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
      setIsEditor(me.role === 'editor')

      await loadData()
      setLoading(false)
    }
    init()
  }, [])

  // Convert a stored ISO timestamp to a datetime-local value in the browser's timezone
  const isoToLocalInput = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const openEditPanel = (u) => {
    setFlagEditorFor(null)
    setEditPanelFor(u.id)
    setEditText(u.cleaned_readable_update || u.raw_text || '')
    setEditTime(isoToLocalInput(u.event_time || u.created_at))
  }

  const handleSaveEdit = async (u) => {
    if (!editText.trim()) {
      setMessage('❌ Update text cannot be empty')
      return
    }

    const payload = { update_id: u.id }

    const currentText = u.cleaned_readable_update || u.raw_text || ''
    if (editText.trim() !== currentText) {
      payload.new_text = editText.trim()
    }

    const currentTimeLocal = isoToLocalInput(u.event_time || u.created_at)
    if (editTime && editTime !== currentTimeLocal) {
      const d = new Date(editTime)
      if (!isNaN(d.getTime())) {
        payload.new_event_time = d.toISOString()
      }
    }

    if (!payload.new_text && !payload.new_event_time) {
      setEditPanelFor(null)
      return
    }

    const res = await fetch('/api/updates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('✅ Update saved')
      setEditPanelFor(null)
      loadData()
    }
  }

  const handleDeleteUpdate = async (u) => {
    const preview = (u.cleaned_readable_update || u.raw_text || '').slice(0, 80)
    if (!confirm(`🗑️ Delete this update?\n\n"${preview}..."\n\nThis cannot be undone.`)) {
      return
    }

    const res = await fetch('/api/updates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: u.id }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('🗑️ Update deleted')
      setFlagEditorFor(null)
      setEditPanelFor(null)
      loadData()
    }
  }

  const handleToggleFlag = async (u, flagKey) => {
    const res = await fetch('/api/updates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ update_id: u.id, [flagKey]: !u[flagKey] }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('✅ Flags updated')
      loadData()
    }
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
      cancelled: 'Cancelled',
      delayed: 'Delayed',
      issue: 'Issue',
      unknown: 'Unknown',
    }
    return labels[status] || status
  }

  const outcomeText = (v) => {
    if (!v.completed) return statusLabel(v.current_status)
    if (v.outcome === 'cancelled') return '⛔ Cancelled'
    if (v.outcome === 'partial') return '🟡 Partially Completed'
    return '✔️ Completed'
  }

  const entryIcon = (u) => {
    if (!u.raw_text || !u.raw_text.startsWith('[BUTTON]')) {
      if (u.security_issue) return '🔴'
      if (u.access_denied) return '🚧'
      if (u.delay_flag) return '⚠️'
      if (u.data_quality_issue) return '📉'
      return '💬'
    }
    if (u.raw_text.includes('Visit cancelled')) return '⛔'
    if (u.raw_text.includes('Departed to location')) return '🚗'
    if (u.raw_text.includes('Arrived at location')) return '📍'
    if (u.raw_text.includes('collection started')) return '📋'
    if (u.raw_text.includes('collection finished')) return '✅'
    if (u.raw_text.includes('Departing to home base')) return '🏠'
    if (u.raw_text.includes('partially completed')) return '🟡'
    if (u.raw_text.includes('visit completed')) return '🎯'
    return '🔘'
  }

  const isButtonEntry = (u) => u.raw_text && u.raw_text.startsWith('[BUTTON]')

  const FLAG_DEFS = [
    { key: 'security_issue', label: '🔴 Security', bg: '#fee2e2', color: '#991b1b' },
    { key: 'delay_flag', label: '⚠️ Delay', bg: '#fef3c7', color: '#92400e' },
    { key: 'access_denied', label: '🚧 Access Denied', bg: '#f3e8ff', color: '#6b21a8' },
    { key: 'data_quality_issue', label: '📉 Data Quality', bg: '#e0f2fe', color: '#075985' },
  ]

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

  return (
    <main style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>

      {/* Toolbar */}
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

      {message && (
        <p className="no-print" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>{message}</p>
      )}

      {/* Visit info */}
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
          <strong>{visit.completed ? 'Outcome:' : 'Status:'}</strong> {outcomeText(visit)}
          {visit.archived ? ' · 📦 Archived' : ''}
        </p>
        {visit.completed && visit.arrival_home_base_time && (
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.95rem' }}>
            <strong>Closed:</strong> {ft(visit.arrival_home_base_time)}
          </p>
        )}
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
          {/* Visit created entry */}
          <div style={{
            display: 'flex',
            gap: '0.9rem',
            paddingBottom: updates.length > 0 ? '1.1rem' : 0,
            position: 'relative'
          }}>
            {updates.length > 0 && (
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
              🗓
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                fontWeight: 600,
                marginBottom: '0.15rem'
              }}>
                {ft(visit.created_at)}
              </div>
              <div style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 600 }}>
                Visit created
              </div>
            </div>
          </div>

          {/* Updates */}
          {updates.map((u, i) => (
            <div key={u.id} style={{
              display: 'flex',
              gap: '0.9rem',
              paddingBottom: i === updates.length - 1 ? 0 : '1.1rem',
              position: 'relative'
            }}>
              {i !== updates.length - 1 && (
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
                {entryIcon(u)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.3rem',
                  marginBottom: '0.15rem'
                }}>
                  <span style={{
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    fontWeight: 600
                  }}>
                    {ft(u.event_time || u.created_at)}
                  </span>
                  {isEditor && (
                    <span className="no-print" style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => editPanelFor === u.id ? setEditPanelFor(null) : openEditPanel(u)}
                        style={{
                          padding: '0.15rem 0.5rem',
                          background: editPanelFor === u.id ? '#1a56db' : '#f1f5f9',
                          color: editPanelFor === u.id ? 'white' : '#475569',
                          border: '1px solid ' + (editPanelFor === u.id ? '#1a56db' : '#e2e8f0'),
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => { setEditPanelFor(null); setFlagEditorFor(flagEditorFor === u.id ? null : u.id) }}
                        style={{
                          padding: '0.15rem 0.5rem',
                          background: flagEditorFor === u.id ? '#1a56db' : '#f1f5f9',
                          color: flagEditorFor === u.id ? 'white' : '#475569',
                          border: '1px solid ' + (flagEditorFor === u.id ? '#1a56db' : '#e2e8f0'),
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        🚩 Flags
                      </button>
                      <button
                        onClick={() => handleDeleteUpdate(u)}
                        style={{
                          padding: '0.15rem 0.5rem',
                          background: '#fef2f2',
                          color: '#b91c1c',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </span>
                  )}
                </div>

                <div style={{
                  fontSize: '0.95rem',
                  color: isButtonEntry(u) ? '#475569' : '#0f172a',
                  fontWeight: isButtonEntry(u) ? 600 : 400
                }}>
                  {u.cleaned_readable_update || u.raw_text}
                </div>

                {/* Current flags */}
                {(u.security_issue || u.delay_flag || u.access_denied || u.data_quality_issue || u.needs_human_review) && (
                  <div style={{ marginTop: '0.35rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {FLAG_DEFS.map(f => u[f.key] && (
                      <span key={f.key} style={{ background: f.bg, color: f.color, padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        {f.label}
                      </span>
                    ))}
                    {u.needs_human_review && (
                      <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '0.1rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                        👀 Needs Review
                      </span>
                    )}
                  </div>
                )}

                {/* Edit panel: text + timestamp */}
                {isEditor && editPanelFor === u.id && (
                  <div className="no-print" style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Update text:
                    </label>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.7rem',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        marginBottom: '0.6rem'
                      }}
                    />
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.3rem' }}>
                      Event time:
                    </label>
                    <input
                      type="datetime-local"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem 0.7rem',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        boxSizing: 'border-box',
                        marginBottom: '0.6rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleSaveEdit(u)}
                        style={{
                          padding: '0.4rem 1rem',
                          background: '#16a34a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}
                      >
                        💾 Save
                      </button>
                      <button
                        onClick={() => setEditPanelFor(null)}
                        style={{
                          padding: '0.4rem 1rem',
                          background: '#f1f5f9',
                          color: '#475569',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.85rem'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Flag editor panel */}
                {isEditor && flagEditorFor === u.id && (
                  <div className="no-print" style={{
                    marginTop: '0.5rem',
                    padding: '0.6rem 0.75rem',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}>
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                      Toggle flags for this update — tap to add or remove:
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {FLAG_DEFS.map(f => (
                        <button
                          key={f.key}
                          onClick={() => handleToggleFlag(u, f.key)}
                          style={{
                            padding: '0.25rem 0.6rem',
                            background: u[f.key] ? f.bg : 'white',
                            color: u[f.key] ? f.color : '#94a3b8',
                            border: u[f.key] ? `2px solid ${f.color}` : '2px dashed #e2e8f0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}
                        >
                          {f.label} {u[f.key] ? '✓' : '+'}
                        </button>
                      ))}
                    </div>
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
