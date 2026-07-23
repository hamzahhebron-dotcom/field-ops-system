'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function CreateVisitPage() {
  const [activityId, setActivityId] = useState('')
  const [enumeratorName, setEnumeratorName] = useState('')
  const [targetLocation, setTargetLocation] = useState('')
  const [plannedDeparture, setPlannedDeparture] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
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
    }
    checkAuth()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const res = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activity_id: activityId,
        enumerator_name: enumeratorName,
        target_location: targetLocation,
        planned_departure_time: plannedDeparture,
      }),
    })

    const data = await res.json()

    if (data.error) {
      setMessage('❌ Error: ' + data.error)
    } else {
      setMessage('✅ Visit created successfully!')
      setActivityId('')
      setEnumeratorName('')
      setTargetLocation('')
      setPlannedDeparture('')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    padding: '0.6rem 0.8rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '1rem',
    boxSizing: 'border-box'
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '0.4rem',
    fontWeight: 500
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
        maxWidth: '450px'
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
          📋 Create New Visit
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Coordinator — plan a new field visit
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Activity ID</label>
            <input
              type="text"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              placeholder="e.g. GZ-204"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Enumerator Name</label>
            <input
              type="text"
              value={enumeratorName}
              onChange={(e) => setEnumeratorName(e.target.value)}
              placeholder="e.g. Ahmad"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Target Location</label>
            <input
              type="text"
              value={targetLocation}
              onChange={(e) => setTargetLocation(e.target.value)}
              placeholder="e.g. Al-Amal Clinic"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Planned Departure Time</label>
            <input
              type="datetime-local"
              value={plannedDeparture}
              onChange={(e) => setPlannedDeparture(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {message && (
            <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: loading ? '#aaa' : '#1a56db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Creating...' : 'Create Visit'}
          </button>
        </form>
      </div>
    </main>
  )
}
