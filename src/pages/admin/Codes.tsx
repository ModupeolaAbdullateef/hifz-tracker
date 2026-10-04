import { useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner, SuccessBanner } from '../../components/LoadingAndEmpty'
import { setCodes } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

export default function Codes() {
  const { session } = useAuth()
  const [teacherCode, setTeacherCode] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      await setCodes(session.token, teacherCode.trim() || null, adminCode.trim() || null)
      setMessage('Codes updated. Share the new codes with staff — existing sessions stay valid until they expire.')
      setTeacherCode('')
      setAdminCode('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the codes.')
    }
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Change teacher &amp; admin codes</h2>
        <p className="muted">Leave a field blank to keep that code unchanged.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="teacher-code">New teacher code</label>
            <input id="teacher-code" value={teacherCode} onChange={(e) => setTeacherCode(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="admin-code">New admin code</label>
            <input id="admin-code" value={adminCode} onChange={(e) => setAdminCode(e.target.value)} />
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <button type="submit" className="btn btn-primary">
            Update codes
          </button>
        </form>
      </div>
    </AdminGuard>
  )
}
