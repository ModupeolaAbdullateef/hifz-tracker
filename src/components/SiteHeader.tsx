import { Link } from 'react-router-dom'

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
          <h1 className="site-header__title">
            Hifz Progress
            <small className="arabic">تقدم الحفظ</small>
          </h1>
        </Link>
      </div>
    </header>
  )
}
