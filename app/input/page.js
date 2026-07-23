'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function InputPage() {
  const [visits, setVisits] = useState([])
  const [selectedVisit, setSelectedVisit] = useState('')
  const [updateText, setUpdateText] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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
      // Load active visits into the dropdown
      const res = await fetch('/api/visits')
      const data = await res.json()
      if (data.visits) {
        setVisits(data.visits.filter(v => !v.completed))
      }
    }
    init()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const res = await fetch('/api/updates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visit_id: selectedVisit,
        raw_text: updateText,
      }),
    })

    const data = await res.json()

    if (data.error) {
      setMessage('❌ Error: ' + data.error)
    } else {
      setMessage('✅ Update submitted successfully!')
      setUpdateText('')
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
        maxWidth: '500px'
      }}>
        <h1 style={{ marginBottom: '0.25rem', fontSize: '1.4rem' }}>
          📡 Submit Field Update
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Enumerator — send your visit update
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
              Select Visit
            </label>
            <select
              value={selectedVisit}
              onChange={(e) => setSelectedVisit(e.target.value)}
              required
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

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
              Update Text
            </label>
            <textarea
              value={updateText}
              onChange={(e) => setUpdateText(e.target.value)}
              placeholder="e.g. GZ-204 Ahmad arrived at Al-Amal Clinic at 10:50. Started observation. No security issue. Next check at 12:00."
              required
              rows={5}
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
            type="submit"
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
            {loading ? 'Submitting...' : 'Submit Update'}
          </button>
        </form>
      </div>
    </main>
  )
}
