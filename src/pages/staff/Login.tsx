import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import PublicNav from '../../components/PublicNav'
import { ErrorBanner } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const returnTo = (useLocation().state as { from?: string } | null)?.from ?? '/staff'
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
      navigate(returnTo)
    } catch {
      setError('That code did not work. Please check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page page--narrow">
        <PublicNav />
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
              <p className="field-hint">Only used so we can see who filled in each week.</p>
            </div>
            <div className="field">
              <label htmlFor="code">Code</label>
              <input
                id="code"
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                autoComplete="current-password"
              />
              <p className="field-hint">You'll stay logged in on this device for 12 hours.</p>
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
