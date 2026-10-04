import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import { useAuth } from '../../context/AuthContext'

export default function StaffLayout() {
  const { session, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  if (!session) {
    return <Navigate to="/staff/login" replace />
  }

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
            Signed in as <strong>{session.display_name}</strong> ({session.role})
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>

        <nav className="nav-tabs">
          <NavLink to="/staff" end>
            Find student
          </NavLink>
          <NavLink to="/staff/week">This Thursday</NavLink>
          <NavLink to="/staff/overview">Class overview</NavLink>
          {isAdmin && (
            <>
              <NavLink to="/staff/admin/enquiries">Enquiries</NavLink>
              <NavLink to="/staff/admin/students">Students</NavLink>
              <NavLink to="/staff/admin/course">Course</NavLink>
              <NavLink to="/staff/admin/fields">Fields</NavLink>
              <NavLink to="/staff/admin/tips">Tips</NavLink>
              <NavLink to="/staff/admin/docs">Docs</NavLink>
              <NavLink to="/staff/admin/codes">Codes</NavLink>
              <NavLink to="/staff/admin/export">Export</NavLink>
            </>
          )}
        </nav>

        <Outlet />
      </main>
    </div>
  )
}
