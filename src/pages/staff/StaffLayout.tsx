import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import { ErrorBanner, LoadingState } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'
import { CourseProvider, useCourse } from '../../context/CourseContext'

export default function StaffLayout() {
  const { session } = useAuth()

  if (!session) {
    return <Navigate to="/staff/login" replace />
  }

  return (
    <CourseProvider>
      <StaffShell />
    </CourseProvider>
  )
}

function StaffShell() {
  const { session, isAdmin, logout } = useAuth()
  const { courses, course, loading, error, selectCourse } = useCourse()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/staff/login')
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page">
        <div className="flex-between" style={{ marginBottom: '1rem' }}>
          <div>
            Signed in as <strong>{session?.display_name}</strong> ({session?.role})
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>

        {courses.length > 0 && course && (
          <div className="course-picker">
            <label htmlFor="course-picker">Course</label>
            <select id="course-picker" value={course.id} onChange={(e) => selectCourse(Number(e.target.value))}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.active ? '' : ' (archived)'} · {c.student_count} student{c.student_count === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="nav-tabs">
          <NavLink to="/staff" end>
            Find student
          </NavLink>
          <NavLink to="/staff/week">This week</NavLink>
          <NavLink to="/staff/overview">Class overview</NavLink>
          {isAdmin && (
            <>
              <NavLink to="/staff/admin/enquiries">Enquiries</NavLink>
              <NavLink to="/staff/admin/students">Students</NavLink>
              <NavLink to="/staff/admin/course">Courses</NavLink>
              <NavLink to="/staff/admin/fields">Fields</NavLink>
              <NavLink to="/staff/admin/tips">Tips</NavLink>
              <NavLink to="/staff/admin/docs">Docs</NavLink>
              <NavLink to="/staff/admin/codes">Codes</NavLink>
              <NavLink to="/staff/admin/export">Export</NavLink>
            </>
          )}
        </nav>

        {error && <ErrorBanner text={error} />}
        {loading ? <LoadingState /> : <Outlet />}
      </main>
    </div>
  )
}
