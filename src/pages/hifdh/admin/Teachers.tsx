import { useEffect, useState } from 'react'
import AdminGuard from '../../../components/AdminGuard'
import { ErrorBanner, SuccessBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import { deleteTeacher, getAdminStudents, upsertTeacher } from '../../../hifdh/api'
import { compareNames } from '../../../hifdh/rules'
import { useTerm } from '../../../hifdh/TermContext'
import type { AdminStudent, Teacher } from '../../../hifdh/types'

const empty = { id: null as string | null, groupId: 0, name: '', initials: '', colour: '', studentId: '', active: true }

/** A6: teachers with their initials and group. */
export default function Teachers() {
  const { session } = useAuth()
  const { boot, groups, reloadBoot, reloadTerm } = useTerm()
  const [form, setForm] = useState(empty)
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const groupId = form.groupId || groups[0]?.id || 0

  useEffect(() => {
    if (!session || !groupId) return
    getAdminStudents(session.token, groupId).then(setStudents).catch(() => setStudents([]))
  }, [session, groupId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)
    try {
      await upsertTeacher(session.token, {
        id: form.id,
        groupId,
        name: form.name,
        initials: form.initials,
        colour: form.colour || null,
        studentId: form.studentId || null,
        active: form.active,
      })
      setMessage(form.id ? 'Teacher updated.' : `${form.name} added. They can now pick their name when logging in.`)
      setForm({ ...empty, groupId })
      await reloadBoot()
      await reloadTerm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  const teachers = [...(boot?.teachers ?? [])].sort((a, b) => compareNames(a.name, b.name))

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">{form.id ? 'Edit teacher' : 'Add a teacher'}</h2>
        <form onSubmit={submit}>
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 2, minWidth: 180 }}>
              <label htmlFor="t-name">Name</label>
              <input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field" style={{ width: 100 }}>
              <label htmlFor="t-init">Initials</label>
              <input id="t-init" value={form.initials} maxLength={4} onChange={(e) => setForm({ ...form, initials: e.target.value.toUpperCase() })} required />
            </div>
            <div className="field">
              <label htmlFor="t-group">Group</label>
              <select id="t-group" value={groupId} onChange={(e) => setForm({ ...form, groupId: Number(e.target.value), studentId: '' })}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="t-colour">Colour flag</label>
              <input id="t-colour" type="color" value={form.colour || '#1d7a3e'} onChange={(e) => setForm({ ...form, colour: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="t-student">Also a student? (their own revision lines)</label>
            <select id="t-student" value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              <option value="">No</option>
              {students
                .filter((s) => s.status !== 'archived')
                .sort((a, b) => compareNames(a.display_name, b.display_name))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.display_name} ({s.code})
                  </option>
                ))}
            </select>
            <p className="field-hint">Their name is shown in green on the Overview.</p>
          </div>
          <label className="tick-box" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span>Active (shown on the login list)</span>
          </label>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save' : 'Add teacher'}
            </button>
            {form.id && (
              <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...empty, groupId })}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h2 className="mt-0">Teachers</h2>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Initials</th>
                <th>Group</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {teachers.map((t: Teacher) => (
                <tr key={t.id}>
                  <td>
                    {t.colour && <span className="rec-dot" style={{ display: 'inline-block', background: t.colour, marginRight: 6 }} />}
                    <span className="teacher-name">{t.name}</span>
                  </td>
                  <td>{t.initials}</td>
                  <td>{groups.find((g) => g.id === t.group_id)?.name}</td>
                  <td>{t.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <div className="flex gap-1">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setForm({
                            id: t.id,
                            groupId: t.group_id,
                            name: t.name,
                            initials: t.initials,
                            colour: t.colour ?? '',
                            studentId: t.student_id ?? '',
                            active: t.active,
                          })
                        }
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={async () => {
                          if (!session || !window.confirm(`Remove ${t.name}? Results they recorded keep their initials.`)) return
                          await deleteTeacher(session.token, t.id)
                          await reloadBoot()
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminGuard>
  )
}
