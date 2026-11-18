import SiteHeader from '../../components/SiteHeader'
import SiteFooter from '../../components/SiteFooter'
import PublicNav from '../../components/PublicNav'

/** Students open their record from their own personal link, so there is no public name search. */
export default function MyRecord() {
  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page page--narrow">
        <PublicNav />
        <div className="card">
          <h2 className="mt-0">My Hifdh record</h2>
          <p>
            Every student has their own <strong>personal link</strong> and a <strong>4-digit PIN</strong>. Open the link your teacher sent
            you (it stays the same all course, like your old PDF link) and enter your PIN.
          </p>
          <p className="muted">
            Lost your link or PIN? Ask your teacher. They can send it again from the portal. Only you can see your own record.
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
