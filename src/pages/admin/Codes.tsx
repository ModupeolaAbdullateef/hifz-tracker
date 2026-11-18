import { useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner, SuccessBanner } from '../../components/LoadingAndEmpty'
import { setCodes } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

export default function Codes() {
  const { session } = useAuth()
  const [teacherCode, setTeacherCode] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const newTeacher = teacherCode.trim()
  const newAdmin = adminCode.trim()

  function handleReview(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    if (!newTeacher && !newAdmin) {
      setError('Nothing to change. Both boxes are empty, so the codes stay as they are.')
      return
    }
    setConfirming(true)
  }

  async function handleConfirm() {
    if (!session) return
    setBusy(true)
    setError(null)
    try {
      await setCodes(session.token, newTeacher || null, newAdmin || null)
      const changed = [newTeacher && `teacher code is now ${newTeacher}`, newAdmin && `admin code is now ${newAdmin}`]
        .filter(Boolean)
        .join(' and the ')
      setMessage(
        `Saved. The ${changed}. Tell the other teachers (and the class admin) straight away. Anyone already logged in stays logged in until their 12 hours are up.`,
      )
      setTeacherCode('')
      setAdminCode('')
      setConfirming(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the codes.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Change the login codes</h2>
        <div className="warning-box">
          <strong>Please be careful here.</strong> Changing a code locks everyone out until they're given the new one.
          If you're only testing, have a look but don't save anything.
        </div>
        <p className="muted">
          The <strong>teacher code</strong> opens the teaching pages only. The <strong>admin code</strong> opens
          everything, including this page. Leave a box empty to keep that code as it is.
        </p>
        <form onSubmit={handleReview}>
          <div className="field">
            <label htmlFor="teacher-code">New teacher code</label>
            <input
              id="teacher-code"
              value={teacherCode}
              autoComplete="off"
              disabled={confirming}
              onChange={(e) => setTeacherCode(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="admin-code">New admin code</label>
            <input
              id="admin-code"
              value={adminCode}
              autoComplete="off"
              disabled={confirming}
              onChange={(e) => setAdminCode(e.target.value)}
            />
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}

          {confirming ? (
            <div className="warning-box">
              <p className="mt-0">
                You're about to change:
                {newTeacher && (
                  <>
                    <br />
                    Teacher code → <strong>{newTeacher}</strong>
                  </>
                )}
                {newAdmin && (
                  <>
                    <br />
                    Admin code → <strong>{newAdmin}</strong>
                  </>
                )}
              </p>
              <p>Have you written the new code down? You'll need it the next time you log in.</p>
              <div className="flex gap-2 flex-wrap">
                <button type="button" className="btn btn-danger" onClick={handleConfirm} disabled={busy}>
                  {busy ? 'Saving…' : 'Yes, change the code'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
                  Go back
                </button>
              </div>
            </div>
          ) : (
            <button type="submit" className="btn btn-primary">
              Change codes…
            </button>
          )}
        </form>
      </div>
    </AdminGuard>
  )
}
