import { useEffect, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import { getCourseAdmin, getCourseWeeksAdmin, setWeekCancelled, updateCourse } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatUKDate } from '../../lib/dates'
import type { Course, CourseWeek } from '../../lib/types'

export default function CourseSettings() {
  const { session } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [weeks, setWeeks] = useState<CourseWeek[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    if (!session) return
    setLoading(true)
    try {
      const [w, c] = await Promise.all([getCourseWeeksAdmin(session.token), getCourseAdmin(session.token)])
      setWeeks(w)
      setCourse(c)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the course.')
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
    if (!session || !course) return
    setError(null)
    setMessage(null)
    try {
      await updateCourse(session.token, {
        name: course.name,
        startDate: course.start_date,
        weeks: course.weeks,
        targetPages: course.target_pages,
      })
      setMessage('Course updated.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the course.')
    }
  }

  async function toggleCancelled(week: CourseWeek) {
    if (!session) return
    await setWeekCancelled(session.token, week.week_number, !week.cancelled, week.note)
    await load()
  }

  if (loading) return <LoadingState />

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Course settings</h2>
        {course && (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="course-name">Course name</label>
              <input
                id="course-name"
                value={course.name}
                onChange={(e) => setCourse({ ...course, name: e.target.value })}
              />
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="start-date">Start date</label>
                <input
                  id="start-date"
                  type="date"
                  value={course.start_date}
                  onChange={(e) => setCourse({ ...course, start_date: e.target.value })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="weeks">Number of weeks</label>
                <input
                  id="weeks"
                  type="number"
                  min={1}
                  value={course.weeks}
                  onChange={(e) => setCourse({ ...course, weeks: Number(e.target.value) })}
                />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="target">Default target pages</label>
                <input
                  id="target"
                  type="number"
                  step={0.01}
                  value={course.target_pages ?? ''}
                  onChange={(e) =>
                    setCourse({ ...course, target_pages: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </div>
            </div>
            {error && <ErrorBanner text={error} />}
            {message && <SuccessBanner text={message} />}
            <button type="submit" className="btn btn-primary">
              Save course settings
            </button>
          </form>
        )}
      </div>

      <div className="card">
        <h3 className="mt-0">Weeks</h3>
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
      </div>
    </AdminGuard>
  )
}
