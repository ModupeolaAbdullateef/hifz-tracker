import { useEffect, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import { deactivateStudent, getAllStudentsAdmin, regenerateStudentCode, upsertStudent } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { StudentFull } from '../../lib/types'

const emptyForm = { id: undefined as string | undefined, firstName: '', lastName: '', joinWeek: 1, targetPages: '' }

export default function ManageStudents() {
  const { session } = useAuth()
  const [students, setStudents] = useState<StudentFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [revealedCode, setRevealedCode] = useState<{ id: string; code: string } | null>(null)

  async function load() {
    if (!session) return
    setLoading(true)
    try {
      const rows = await getAllStudentsAdmin(session.token)
      setStudents(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load students.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      const result = await upsertStudent(session.token, {
        id: form.id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        joinWeek: form.joinWeek,
        targetPages: form.targetPages === '' ? null : Number(form.targetPages),
      })
      setMessage(form.id ? 'Student updated.' : `Student added — code ${result.student_code}.`)
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this student.')
    }
  }

  function editStudent(s: StudentFull) {
    setForm({
      id: s.id,
      firstName: s.first_name,
      lastName: s.last_name,
      joinWeek: s.join_week,
      targetPages: s.target_pages === null ? '' : String(s.target_pages),
    })
  }

  async function toggleActive(s: StudentFull) {
    if (!session) return
    await deactivateStudent(session.token, s.id, !s.active)
    await load()
  }

  async function handleRegenerate(s: StudentFull) {
    if (!session) return
    const result = await regenerateStudentCode(session.token, s.id)
    setRevealedCode({ id: s.id, code: result.student_code })
    await load()
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">{form.id ? 'Edit student' : 'Add student'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="firstName">First name</label>
              <input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="lastName">Last name</label>
              <input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="joinWeek">Join week</label>
              <input
                id="joinWeek"
                type="number"
                min={1}
                max={10}
                value={form.joinWeek}
                onChange={(e) => setForm((f) => ({ ...f, joinWeek: Number(e.target.value) }))}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="targetPages">Target pages (optional)</label>
              <input
                id="targetPages"
                type="number"
                step={0.01}
                value={form.targetPages}
                onChange={(e) => setForm((f) => ({ ...f, targetPages: e.target.value }))}
              />
            </div>
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save changes' : 'Add student'}
            </button>
            {form.id && (
              <button type="button" className="btn btn-ghost" onClick={() => setForm(emptyForm)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mt-0">Students</h2>
        {loading ? (
          <LoadingState />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Join week</th>
                  <th>Target</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {s.first_name} {s.last_name}
                    </td>
                    <td>{revealedCode?.id === s.id ? revealedCode.code : s.student_code}</td>
                    <td>{s.join_week}</td>
                    <td>{s.target_pages ?? '—'}</td>
                    <td>{s.active ? 'Active' : 'Inactive'}</td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        <button className="btn btn-ghost btn-sm" onClick={() => editStudent(s)}>
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleRegenerate(s)}>
                          New code
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(s)}>
                          {s.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
