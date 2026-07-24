'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const STATUS_BUTTONS = [
  { key: 'departed_to_location', label: '🚗 Departed to location' },
  { key: 'arrived_at_location', label: '📍 Arrived at location' },
  { key: 'data_collection_started', label: '📋 Data collection started' },
  { key: 'data_collection_finished', label: '✅ Data collection finished' },
  { key: 'departing_to_base', label: '🏠 Departing to home base' },
  { key: 'arrived_at_base', label: '🎯 Arrived at home base (closes visit)' },
]

export default function InputPage() {
  const [visits, setVisits] = useState([])
  const [selectedVisit, setSelectedVisit] = useState('')
  const [selectedEvent, setSelectedEvent] = useState('')
  const [updateText, setUpdateText] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const loadVisits = async () => {
    const res = await fetch('/api/visits')
    const data = await res.json()
    if (data.visits) {
      setVisits(data.visits.filter(v => !v.completed && !v.archived))
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
      loadVisits()
    }
    init()
  }, [])

  const selectedVisitData = visits.find(v => v.id === selectedVisit)

  const handleSubmit = async () => {
    if (!selectedVisit) {
      setMessage('❌ Select a visit first')
      return
    }
    if (!selectedEvent && !updateText.trim()) {
      setMessage('❌ Choose a status button or write a comment')
      return
    }

    setLoading(true)
    setMessage('')

    const res = await fetch('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visit_id: selectedVisit,
        status_event: selectedEvent || null,
        raw_text: updateText.trim() || null,
      }),
    })

    const data = await res.json()

    if (data.error) {
      setMessage('❌ Error: ' + data.error)
    } else {
      if (selectedEvent === 'arrived_at_base') {
        setMessage('✅ Update saved. Visit completed and closed! 🎉')
        setSelectedVisit('')
      } else {
        setMessage('✅ Update submitted successfully!')
      }
      setSelectedEvent('')
      setUpdateText('')
      loadVisits()
    }
    setLoading(false)
  }

  const handleArchive = async () => {
    if (!selectedVisit || !selectedVisitData) {
      setMessage('❌ Select a visit first')
      return
    }
    if (!confirm(`Archive "${selectedVisitData.activity_id} — ${selectedVisitData.enumerator_name}"?\n\nThe visit will move to the Archive. It can be restored later.`)) {
      return
    }

    setLoading(true)
    const res = await fetch('/api/visits', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_id: selectedVisit, archived: true }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('📦 Visit archived')
      setSelectedVisit('')
      setSelectedEvent('')
      setUpdateText('')
      loadVisits()
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!selectedVisit || !selectedVisitData) {
      setMessage('❌ Select a visit first')
      return
    }
    if (!confirm(`⚠️ PERMANENTLY DELETE "${selectedVisitData.activity_id} — ${selectedVisitData.enumerator_name}"?\n\nThis deletes the visit AND its entire update log forever, including any flagged events. This CANNOT be undone.\n\nClick OK to delete permanently.`)) {
      return
    }

    setLoading(true)
    const res = await fetch('/api/visits', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit_id: selectedVisit }),
    })
    const data = await res.json()
    if (data.error) {
      setMessage('❌ ' + data.error)
    } else {
      setMessage('🗑️ Visit permanently deleted')
      setSelectedVisit('')
      setSelectedEvent('')
      setUpdateText('')
      loadVisits()
    }
    setLoading(false)
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f2f5',
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        padding: '2.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '520px'
      }}>
        <a href="/dashboard" style={{
          display: 'inline-block',
          marginBottom: '1rem',
          color: '#1a56db',
          textDecoration: 'none',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          ← Back to Dashboard
        </a>

        <h1 style={{ marginBottom: '0.25rem', fontSize: '1.4rem' }}>
          📡 Submit Field Update
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Choose a status, write a comment, or both
        </p>

        {/* Visit selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Select Visit
          </label>
          <select
            value={selectedVisit}
            onChange={(e) => { setSelectedVisit(e.target.value); setMessage('') }}
            style={{
              width: '100%',
              padding: '0.6rem 0.8rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              boxSizing: 'border-box',
              background: 'white'
            }}
          >
            <option value="">-- Choose a visit --</option>
            {visits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.activity_id} — {v.enumerator_name} — {v.target_location}
              </option>
            ))}
          </select>
        </div>

        {/* Status buttons */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
            Status Update
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {STATUS_BUTTONS.map((btn) => (
              <button
                key={btn.key}
                type="button"
                onClick={() => setSelectedEvent(selectedEvent === btn.key ? '' : btn.key)}
                style={{
                  padding: '0.7rem 0.5rem',
                  background: selectedEvent === btn.key ? '#1a56db' : '#f1f5f9',
                  color: selectedEvent === btn.key ? 'white' : '#334155',
                  border: selectedEvent === btn.key ? '2px solid #1a56db' : '2px solid #e2e8f0',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'left',
                  lineHeight: 1.3
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
          {selectedEvent && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#1a56db' }}>
              Selected — tap again to unselect
            </p>
          )}
        </div>

        {/* Optional comment */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Comment <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={updateText}
            onChange={(e) => setUpdateText(e.target.value)}
            placeholder="e.g. Delayed 20 min at checkpoint, no security issue"
            rows={3}
            style={{
              width: '100%',
              padding: '0.6rem 0.8rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '1rem',
              boxSizing: 'border-box',
              fontFamily: 'inherit',
              resize: 'vertical'
            }}
          />
        </div>

        {message && (
          <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: loading ? '#aaa' : '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Working...' : 'Submit Update'}
        </button>

        {/* Visit management — only shows when a visit is selected */}
        {selectedVisit && (
          <div style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid #e2e8f0'
          }}>
            <p style={{
              margin: '0 0 0.6rem',
              fontSize: '0.8rem',
              color: '#94a3b8',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Visit Management
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleArchive}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                📦 Archive Visit
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  background: '#e53e3e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                🗑️ Delete Visit
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
