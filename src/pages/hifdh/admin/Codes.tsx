import { useState } from 'react'
import AdminGuard from '../../../components/AdminGuard'
import { ErrorBanner, SuccessBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import { setAdminCode, setGroupCode } from '../../../hifdh/api'
import { useTerm } from '../../../hifdh/TermContext'

/** One code per group (teachers then pick their name), plus the admin code. */
export default function Codes() {
  const { session } = useAuth()
  const { groups } = useTerm()
  const [target, setTarget] = useState<string>(String(groups[0]?.id ?? 'admin'))
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const label = target === 'admin' ? 'admin code' : `${groups.find((g) => String(g.id) === target)?.name} teacher code`

  async function save() {
    if (!session) return
    setError(null)
    try {
      if (target === 'admin') await setAdminCode(session.token, code.trim())
      else await setGroupCode(session.token, Number(target), code.trim())
      setMessage(`Saved. The ${label} is now ${code.trim()}. Tell the people who use it straight away.`)
      setCode('')
      setConfirming(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Login codes</h2>
        <div className="warning-box">
          <strong>Please be careful here.</strong> Changing a code locks out everyone who uses it until they're told the new one.
        </div>
        <p className="muted">
          Brothers and Sisters teachers each have their own code. After entering it they pick their name, so their initials go on every
          result. The admin code opens everything for both groups.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setMessage(null)
            if (code.trim().length < 6) {
              setError('Codes must be at least 6 characters.')
              return
            }
            setError(null)
            setConfirming(true)
          }}
        >
          <div className="field">
            <label htmlFor="code-target">Which code</label>
            <select id="code-target" value={target} disabled={confirming} onChange={(e) => setTarget(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} teachers
                </option>
              ))}
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="code-new">New code</label>
            <input id="code-new" value={code} autoComplete="off" disabled={confirming} onChange={(e) => setCode(e.target.value)} />
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          {confirming ? (
            <div className="warning-box">
              <p className="mt-0">
                Change the {label} to <strong>{code.trim()}</strong>? Have you written it down?
              </p>
              <div className="flex gap-2">
                <button type="button" className="btn btn-danger" onClick={save}>
                  Yes, change it
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                  Go back
                </button>
              </div>
            </div>
          ) : (
            <button type="submit" className="btn btn-primary">
              Change code…
            </button>
          )}
        </form>
      </div>
    </AdminGuard>
  )
}
