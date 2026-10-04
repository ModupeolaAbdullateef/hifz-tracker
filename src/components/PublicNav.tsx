import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PublicNav() {
  const { session } = useAuth()
  return (
    <nav className="nav-tabs nav-tabs--public">
      <NavLink to="/" end>
        Home
      </NavLink>
      <NavLink to="/record">My Record</NavLink>
      <NavLink to="/docs">Useful Docs</NavLink>
      <NavLink to={session ? '/staff' : '/staff/login'}>{session ? 'Staff area' : 'Staff / Admin login'}</NavLink>
    </nav>
  )
}
