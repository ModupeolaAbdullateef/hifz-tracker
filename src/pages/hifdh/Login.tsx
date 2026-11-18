import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import { ErrorBanner } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'
import { login as apiLogin, loginStart, type LoginStart } from '../../hifdh/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const returnTo = (useLocation().state as { from?: string } | null)?.from ?? '/staff'
  const [code, setCode] = useState('')
  const [start, setStart] = useState<LoginStart | null>(null)
  const [teacherId, setTeacherId] = useState('')
  const [name, setName] = useState('')
  const [initials, setInitials] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await loginStart(code.trim())
      setStart(res)
      if (res.teachers.length === 1) setTeacherId(res.teachers[0].id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work.')
    } finally {
      setBusy(false)
    }
  }

  async function handleName(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await apiLogin(code.trim(), teacherId || null, teacherId ? null : name, teacherId ? null : initials)
      login(res)
      navigate(returnTo)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.')
    } finally {
      setBusy(false)
    }
  }

  const canType = start && (start.role === 'admin' || start.teachers.length === 0)

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page page--narrow">
        <div className="card">
          <h2 className="mt-0">Staff login</h2>
          {!start ? (
            <form onSubmit={handleCode}>
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
                <p className="field-hint">The Brothers or Sisters teacher code, or the admin code.</p>
              </div>
              {error && <ErrorBanner text={error} />}
              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? 'Checking…' : 'Next'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleName}>
              <p className="mt-0">
                {start.role === 'admin' ? 'Admin login.' : `${start.group_name} teachers.`} Who are you?
              </p>
              {start.teachers.length > 0 && (
                <div className="field">
                  <label htmlFor="teacher">Your name</label>
                  <select id="teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} required={!canType}>
                    <option value="">{canType ? 'Not listed: type below' : 'Pick your name'}</option>
                    {start.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.initials}){start.role === 'admin' ? ` · ${t.group_name}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="field-hint">Your initials go on every result you record.</p>
                </div>
              )}
              {canType && !teacherId && (
                <div className="flex gap-3 flex-wrap">
                  <div className="field" style={{ flex: 2 }}>
                    <label htmlFor="name">Your name</label>
                    <input id="name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="initials">Initials</label>
                    <input
                      id="initials"
                      value={initials}
                      onChange={(e) => setInitials(e.target.value.toUpperCase())}
                      required
                      maxLength={4}
                      placeholder="MMA"
                    />
                  </div>
                </div>
              )}
              {error && <ErrorBanner text={error} />}
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Logging in…' : 'Log in'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setStart(null)
                    setTeacherId('')
                    setError(null)
                  }}
                >
                  Back
                </button>
              </div>
              <p className="field-hint">You'll stay logged in on this device for 12 hours.</p>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
