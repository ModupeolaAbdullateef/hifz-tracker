import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/** Public-page footer. Teachers are told to scroll to the bottom and tap "Staff login". */
export default function SiteFooter() {
  const { session } = useAuth()
  return (
    <footer className="site-footer">
      <span>Hifz Class</span>
      <span aria-hidden="true"> · </span>
      <Link to="/docs">Useful Docs</Link>
      <span aria-hidden="true"> · </span>
      <Link to={session ? '/staff' : '/staff/login'}>{session ? 'Staff area' : 'Staff login'}</Link>
    </footer>
  )
}
