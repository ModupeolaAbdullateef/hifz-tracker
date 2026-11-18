import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import { ErrorBanner, LoadingState } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'
import { RevisionPortionList, SyncBadge } from '../../hifdh/components'
import { TermProvider, useTerm } from '../../hifdh/TermContext'

export default function StaffLayout() {
  const { session } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/staff/login" replace state={{ from: location.pathname }} />
  return (
    <TermProvider>
      <Shell />
    </TermProvider>
  )
}

const TEACHER_TABS = [
  { to: '/staff', label: 'Record', icon: '✍️', end: true },
  { to: '/staff/overview', label: 'Overview', icon: '📋' },
  { to: '/staff/week', label: 'This week', icon: '📌' },
  { to: '/staff/reminders', label: 'Reminders', icon: '💬' },
]

const ADMIN_TABS = [
  { to: '/staff/admin/students', label: 'Students' },
  { to: '/staff/admin/registration', label: 'Registration' },
  { to: '/staff/admin/partners', label: 'Partners' },
  { to: '/staff/admin/terms', label: 'Terms' },
  { to: '/staff/admin/teachers', label: 'Teachers' },
  { to: '/staff/admin/import', label: 'Import' },
  { to: '/staff/admin/export', label: 'Export' },
  { to: '/staff/admin/audit', label: 'Audit' },
  { to: '/staff/admin/codes', label: 'Codes' },
  { to: '/staff/admin/tips', label: 'Tips' },
  { to: '/staff/admin/docs', label: 'Docs' },
  { to: '/staff/admin/enquiries', label: 'Enquiries' },
]

function Shell() {
  const { session, isAdmin, logout } = useAuth()
  const { groups, group, terms, term, selectGroup, selectTerm, loading, error, initials } = useTerm()
  const navigate = useNavigate()
  const [moreOpen, setMoreOpen] = useState(false)

  async function handleLogout() {
    await logout()
    navigate('/staff/login')
  }

  return (
    <div className="hf-shell">
      <SiteHeader />
      <main className="page page--wide">
        <div className="hf-topbar no-print">
          {isAdmin && groups.length > 1 && (
            <select aria-label="Group" value={group?.id ?? ''} onChange={(e) => selectGroup(Number(e.target.value))}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          )}
          {!isAdmin && group && <strong>{group.name}</strong>}
          {terms.length > 0 && (
            <select aria-label="Term" value={term?.id ?? ''} onChange={(e) => selectTerm(Number(e.target.value))}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.archived ? ' (history)' : ''}
                </option>
              ))}
            </select>
          )}
          <SyncBadge />
          <div className="hf-topbar__who">
            <span>
              {session?.display_name}
              {initials && <span className="muted"> · {initials}</span>}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
              Log out
            </button>
          </div>
        </div>

        <nav className="hf-tabs no-print" aria-label="Staff pages">
          {TEACHER_TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end}>
              {t.label}
            </NavLink>
          ))}
          {isAdmin && ADMIN_TABS.map((t) => (
            <NavLink key={t.to} to={t.to}>
              {t.label}
            </NavLink>
          ))}
        </nav>

        {error && <ErrorBanner text={error} />}
        {loading ? <LoadingState /> : <Outlet />}
      </main>

      <nav className="hf-bottomnav no-print" aria-label="Staff pages">
        {TEACHER_TABS.slice(0, 3).map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}>
            <span className="hf-bottomnav__icon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </NavLink>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)}>
          <span className="hf-bottomnav__icon" aria-hidden="true">
            ☰
          </span>
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="hf-more" onClick={() => setMoreOpen(false)}>
          <div className="hf-more__panel" onClick={(e) => e.stopPropagation()}>
            {[TEACHER_TABS[3], ...(isAdmin ? ADMIN_TABS : [])].map((t) => (
              <Link key={t.to} to={t.to} onClick={() => setMoreOpen(false)}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <RevisionPortionList />
    </div>
  )
}
