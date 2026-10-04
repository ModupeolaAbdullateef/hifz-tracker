import { Link } from 'react-router-dom'
import BrandMark from './BrandMark'

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand">
          <BrandMark />
          <h1 className="site-header__title">
            Hifz Progress
            <small className="arabic">تقدم الحفظ</small>
          </h1>
        </Link>
      </div>
    </header>
  )
}
