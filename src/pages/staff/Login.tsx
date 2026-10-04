import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import { ErrorBanner } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(displayName.trim(), code.trim())
      navigate('/staff')
    } catch {
      setError('Incorrect name or access code.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page page--narrow">
        <div className="card">
          <h2>Staff login</h2>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="name">Your name</label>
              <input
                id="name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="code">Access code</label>
              <input
                id="code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {error && <ErrorBanner text={error} />}
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? 'Checking…' : 'Log in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
