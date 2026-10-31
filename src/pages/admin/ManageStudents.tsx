import { useEffect, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import {
  deactivateStudent,
  deleteStudent,
  getAllStudentsAdmin,
  regenerateStudentCode,
  upsertStudent,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useCourse } from '../../context/CourseContext'
import type { StudentFull } from '../../lib/types'

const emptyForm = {
  id: undefined as string | undefined,
  courseId: null as number | null,
  firstName: '',
  lastName: '',
  joinWeek: 1,
  targetPages: '',
}

export default function ManageStudents() {
  const { session } = useAuth()
  const { course, courses, refresh: refreshCourses } = useCourse()
  const [students, setStudents] = useState<StudentFull[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [revealedCode, setRevealedCode] = useState<{ id: string; code: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function load() {
    if (!session || !course) return
    setLoading(true)
    try {
      const rows = await getAllStudentsAdmin(session.token, course.id)
      setStudents(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load students.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setForm(emptyForm)
    setConfirmDelete(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, course?.id])

  if (!course) return <EmptyState text="Add a course on the Courses tab before adding students." />

  const formCourseId = form.courseId ?? course.id
  const formCourse = courses.find((c) => c.id === formCourseId) ?? course

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !course) return
    setError(null)
    setMessage(null)
    try {
      const result = await upsertStudent(session.token, {
        id: form.id,
        courseId: formCourseId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        joinWeek: form.joinWeek,
        targetPages: form.targetPages === '' ? null : Number(form.targetPages),
      })
      const movedTo = formCourseId !== course.id ? ` and moved to ${formCourse.name}` : ''
      setMessage(form.id ? `Student updated${movedTo}.` : `Student added to ${formCourse.name} — code ${result.student_code}.`)
      setForm(emptyForm)
      await Promise.all([load(), refreshCourses()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this student.')
    }
  }

  function editStudent(s: StudentFull) {
    setForm({
      id: s.id,
      courseId: s.course_id,
      firstName: s.first_name,
      lastName: s.last_name,
      joinWeek: s.join_week,
      targetPages: s.target_pages === null ? '' : String(s.target_pages),
    })
  }

  async function toggleActive(s: StudentFull) {
    if (!session) return
    await deactivateStudent(session.token, s.id, !s.active)
    await Promise.all([load(), refreshCourses()])
  }

  async function handleDelete(s: StudentFull) {
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      await deleteStudent(session.token, s.id)
      setConfirmDelete(null)
      if (form.id === s.id) setForm(emptyForm)
      setMessage(`${s.first_name} ${s.last_name} deleted.`)
      await Promise.all([load(), refreshCourses()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this student.')
    }
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
        <h2 className="mt-0">{form.id ? 'Edit student' : `Add student to ${course.name}`}</h2>
        <form onSubmit={handleSubmit}>
          {form.id && courses.length > 1 && (
            <div className="field">
              <label htmlFor="studentCourse">Course</label>
              <select
                id="studentCourse"
                value={formCourseId}
                onChange={(e) => setForm((f) => ({ ...f, courseId: Number(e.target.value) }))}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Moving a student keeps their weekly records, matched by week number.
              </p>
            </div>
          )}
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
                max={formCourse.weeks}
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
        <h2 className="mt-0">Students in {course.name}</h2>
        {loading ? (
          <LoadingState />
        ) : students.length === 0 ? (
          <EmptyState text="No students in this course yet." />
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
                        {confirmDelete === s.id ? (
                          <>
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>
                              Delete for good
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                              Keep
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(s.id)}>
                            Delete
                          </button>
                        )}
                      </div>
                      {confirmDelete === s.id && (
                        <p className="field-hint">
                          This also deletes all of {s.first_name}'s weekly records and badges. Deactivate instead
                          to keep their history.
                        </p>
                      )}
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
