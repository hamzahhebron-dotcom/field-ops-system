'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState('')
  const router = useRouter()

  const handleLogin = async (mode) => {
    if (!email || !password) {
      setError('Please enter email and password')
      return
    }
    setLoading(mode)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading('')
    } else {
      router.push(mode === 'viewer' ? '/view' : '/dashboard')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '0.6rem 0.8rem',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '1rem',
    boxSizing: 'border-box'
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f0f2f5'
    }}>
      <div style={{
        background: 'white',
        padding: '2.5rem',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <h1 style={{ marginBottom: '0.25rem', fontSize: '1.5rem' }}>
          🛡️ Field Ops System
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Secure login — authorized personnel only
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 500 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        {error && (
          <p style={{ color: 'red', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}

        <button
          onClick={() => handleLogin('editor')}
          disabled={loading !== ''}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: loading === 'editor' ? '#aaa' : '#1a56db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading !== '' ? 'not-allowed' : 'pointer',
            marginBottom: '0.75rem'
          }}
        >
          {loading === 'editor' ? 'Logging in...' : '✏️ Login as Editor'}
        </button>

        <button
          onClick={() => handleLogin('viewer')}
          disabled={loading !== ''}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: loading === 'viewer' ? '#aaa' : '#64748b',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: loading !== '' ? 'not-allowed' : 'pointer'
          }}
        >
          {loading === 'viewer' ? 'Logging in...' : '👁️ Login as Viewer'}
        </button>
      </div>
    </main>
  )
}
