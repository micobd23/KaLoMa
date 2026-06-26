import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setLoading(true)
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setMsg({ text: error.message, type: 'error' })
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setMsg({ text: error.message, type: 'error' })
      else setMsg({ text: 'Fast geschafft! Bitte E-Mail bestätigen.', type: 'success' })
    }
    setLoading(false)
  }

  function switchMode() {
    setMode(m => m === 'login' ? 'register' : 'login')
    setMsg(null)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🥗</div>
        <h1 className="auth-title">KaLoMa</h1>
        <p className="auth-subtitle">Kalorien &amp; Makros tracken</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>E-Mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.de" required autoComplete="email" />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
          </div>
          {msg && <p className={msg.type === 'error' ? 'auth-error' : 'auth-success'}>{msg.text}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={loading}>
            {loading ? '…' : mode === 'login' ? 'Anmelden' : 'Registrieren'}
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'Noch kein Konto?' : 'Bereits registriert?'}
          <button onClick={switchMode}>{mode === 'login' ? 'Registrieren' : 'Anmelden'}</button>
        </p>
      </div>
    </div>
  )
}
