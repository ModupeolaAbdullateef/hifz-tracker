import { useEffect, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import {
  createCourse,
  deleteCourse,
  getCourseWeeks,
  setCourseActive,
  setWeekCancelled,
  updateCourse,
} from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useCourse } from '../../context/CourseContext'
import { formatUKDate } from '../../lib/dates'
import type { CourseSummary, CourseWeek } from '../../lib/types'

interface CourseForm {
  name: string
  startDate: string
  weeks: number
  targetPages: string
}

const emptyNewCourse: CourseForm & { copyFieldsFrom: string } = {
  name: '',
  startDate: '',
  weeks: 10,
  targetPages: '',
  copyFieldsFrom: '',
}

function toForm(c: CourseSummary): CourseForm {
  return {
    name: c.name,
    startDate: c.start_date,
    weeks: c.weeks,
    targetPages: c.target_pages === null ? '' : String(c.target_pages),
  }
}

export default function CourseSettings() {
  const { session } = useAuth()
  const { courses, course, selectCourse, refresh } = useCourse()
  const [form, setForm] = useState<CourseForm | null>(null)
  const [weeks, setWeeks] = useState<CourseWeek[]>([])
  const [loadingWeeks, setLoadingWeeks] = useState(true)
  const [newCourse, setNewCourse] = useState(emptyNewCourse)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [newError, setNewError] = useState<string | null>(null)

  async function loadWeeks() {
    if (!session || !course) return
    setLoadingWeeks(true)
    try {
      setWeeks(await getCourseWeeks(session.token, course.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the weeks.')
    } finally {
      setLoadingWeeks(false)
    }
  }

  useEffect(() => {
    setForm(course ? toForm(course) : null)
    setError(null)
    setMessage(null)
    loadWeeks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, course?.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !course || !form) return
    setError(null)
    setMessage(null)
    try {
      await updateCourse(session.token, course.id, {
        name: form.name.trim(),
        startDate: form.startDate,
        weeks: form.weeks,
        targetPages: form.targetPages === '' ? null : Number(form.targetPages),
      })
      setMessage('Course updated.')
      await Promise.all([refresh(), loadWeeks()])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the course.')
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setNewError(null)
    try {
      const id = await createCourse(session.token, {
        name: newCourse.name.trim(),
        startDate: newCourse.startDate,
        weeks: newCourse.weeks,
        targetPages: newCourse.targetPages === '' ? null : Number(newCourse.targetPages),
        copyFieldsFrom: newCourse.copyFieldsFrom === '' ? null : Number(newCourse.copyFieldsFrom),
      })
      setNewCourse(emptyNewCourse)
      await refresh()
      selectCourse(id)
    } catch (e) {
      setNewError(e instanceof Error ? e.message : 'Could not create the course.')
    }
  }

  async function toggleArchived(c: CourseSummary) {
    if (!session) return
    setListError(null)
    try {
      await setCourseActive(session.token, c.id, !c.active)
      await refresh()
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not update the course.')
    }
  }

  async function handleDelete(c: CourseSummary) {
    if (!session) return
    setListError(null)
    try {
      await deleteCourse(session.token, c.id)
      setConfirmDelete(null)
      await refresh()
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Could not delete the course.')
    }
  }

  async function toggleCancelled(week: CourseWeek) {
    if (!session || !course) return
    await setWeekCancelled(session.token, course.id, week.week_number, !week.cancelled, week.note)
    await loadWeeks()
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Courses</h2>
        <p className="muted">
          Each course has its own students, weeks and record fields. Pick which one you're working on from the
          Course menu at the top of every staff page.
        </p>
        {listError && <ErrorBanner text={listError} />}
        {courses.length === 0 ? (
          <EmptyState text="No courses yet — add one below." />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Starts</th>
                  <th>Weeks</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id} className={c.id === course?.id ? 'is-selected' : undefined}>
                    <td>
                      <strong>{c.name}</strong>
                      {c.id === course?.id && <span className="muted"> (selected)</span>}
                    </td>
                    <td>{formatUKDate(c.start_date)}</td>
                    <td>{c.weeks}</td>
                    <td>{c.student_count}</td>
                    <td>{c.active ? 'Active' : 'Archived'}</td>
                    <td>
                      <div className="flex gap-2 flex-wrap">
                        {c.id !== course?.id && (
                          <button className="btn btn-ghost btn-sm" onClick={() => selectCourse(c.id)}>
                            Select
                          </button>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleArchived(c)}>
                          {c.active ? 'Archive' : 'Reactivate'}
                        </button>
                        {c.student_count === 0 &&
                          courses.length > 1 &&
                          (confirmDelete === c.id ? (
                            <>
                              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c)}>
                                Delete for good
                              </button>
                              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                                Keep
                              </button>
                            </>
                          ) : (
                            <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(c.id)}>
                              Delete
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="field-hint">
          Archiving keeps everything and can be undone. Only a course with no students (including deactivated
          ones) can be deleted.
        </p>
      </div>

      {course && form && (
        <div className="card">
          <h2 className="mt-0">{course.name} settings</h2>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="course-name">Course name</label>
              <input
                id="course-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="start-date">Start date</label>
                <input
                  id="start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="weeks">Number of weeks</label>
                <input
                  id="weeks"
                  type="number"
                  min={1}
                  max={52}
                  value={form.weeks}
                  onChange={(e) => setForm({ ...form, weeks: Number(e.target.value) })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="target">Default target pages</label>
                <input
                  id="target"
                  type="number"
                  step={0.01}
                  value={form.targetPages}
                  onChange={(e) => setForm({ ...form, targetPages: e.target.value })}
                />
              </div>
            </div>
            {error && <ErrorBanner text={error} />}
            {message && <SuccessBanner text={message} />}
            <button type="submit" className="btn btn-primary">
              Save course settings
            </button>
          </form>
        </div>
      )}

      {course && (
        <div className="card">
          <h3 className="mt-0">{course.name} weeks</h3>
          {loadingWeeks ? (
            <LoadingState />
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.week_number}>
                      <td>{w.week_number}</td>
                      <td>{formatUKDate(w.class_date)}</td>
                      <td>{w.cancelled ? 'Cancelled' : 'Scheduled'}</td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleCancelled(w)}>
                          {w.cancelled ? 'Reinstate' : 'Cancel (holiday)'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2 className="mt-0">Add a new course</h2>
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="new-course-name">Course name</label>
            <input
              id="new-course-name"
              value={newCourse.name}
              onChange={(e) => setNewCourse((c) => ({ ...c, name: e.target.value }))}
              placeholder="e.g. Spring Hifz Class"
              required
            />
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="new-start-date">Start date (first class)</label>
              <input
                id="new-start-date"
                type="date"
                value={newCourse.startDate}
                onChange={(e) => setNewCourse((c) => ({ ...c, startDate: e.target.value }))}
                required
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="new-weeks">Number of weeks</label>
              <input
                id="new-weeks"
                type="number"
                min={1}
                max={52}
                value={newCourse.weeks}
                onChange={(e) => setNewCourse((c) => ({ ...c, weeks: Number(e.target.value) }))}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="new-target">Default target pages (optional)</label>
              <input
                id="new-target"
                type="number"
                step={0.01}
                value={newCourse.targetPages}
                onChange={(e) => setNewCourse((c) => ({ ...c, targetPages: e.target.value }))}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-copy-fields">Record fields</label>
            <select
              id="new-copy-fields"
              value={newCourse.copyFieldsFrom}
              onChange={(e) => setNewCourse((c) => ({ ...c, copyFieldsFrom: e.target.value }))}
            >
              <option value="">Start with the standard fields (New Hifz, Old Hifz, Revision, Tajweed)</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  Copy the fields from {c.name}
                </option>
              ))}
            </select>
            <p className="field-hint">You can change the fields afterwards on the Fields tab.</p>
          </div>
          {newError && <ErrorBanner text={newError} />}
          <button type="submit" className="btn btn-primary">
            Add course
          </button>
        </form>
      </div>
    </AdminGuard>
  )
}
