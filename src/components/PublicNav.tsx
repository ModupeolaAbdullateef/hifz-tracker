import { NavLink } from 'react-router-dom'

export default function PublicNav() {
  return (
    <nav className="nav-tabs nav-tabs--public">
      <NavLink to="/" end>
        My Record
      </NavLink>
      <NavLink to="/docs">Useful Docs</NavLink>
    </nav>
  )
}
