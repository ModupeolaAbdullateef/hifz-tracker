import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import TipsMarquee from '../../components/TipsMarquee'
import PublicNav from '../../components/PublicNav'
import InterestForm from '../../components/InterestForm'
import { getActiveTips } from '../../lib/api'
import { GALLERY, HERO, HIGHLIGHTS, STORIES, STRUCTURE } from '../../content/home'
import type { Tip } from '../../lib/types'

export default function Home() {
  const [tips, setTips] = useState<Tip[]>([])
  const formRef = useRef<HTMLElement>(null)

  useEffect(() => {
    getActiveTips().then(setTips).catch(() => setTips([]))
  }, [])

  // The app uses HashRouter, so in-page #anchors would be read as routes —
  // scroll to the form directly instead.
  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <TipsMarquee tips={tips} />
      <main className="page">
        <PublicNav />

        <section className="hero">
          <p className="hero__eyebrow">{HERO.eyebrow}</p>
          <h2 className="hero__title">{HERO.title}</h2>
          <p className="hero__subtitle">{HERO.subtitle}</p>
          <div className="hero__actions">
            <button type="button" className="btn btn-coral" onClick={scrollToForm}>
              Register interest
            </button>
            <Link to="/record" className="btn btn-hero-ghost">
              Already enrolled? View my record
            </Link>
          </div>
        </section>

        <section className="home-section">
          <div className="highlight-grid">
            {HIGHLIGHTS.map((h) => (
              <div className="highlight" key={h.title}>
                <div className="highlight__icon" aria-hidden="true">
                  {h.icon}
                </div>
                <h3>{h.title}</h3>
                <p className="muted">{h.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="home-section">
          <h2 className="section-title">How the 10 weeks work</h2>
          <p className="section-lede muted">Every week follows the same rhythm: recite, get feedback, set the next portion.</p>
          <ol className="timeline">
            {STRUCTURE.map((w) => (
              <li className="timeline__item" key={w.weeks}>
                <span className="timeline__weeks">{w.weeks}</span>
                <div>
                  <h3>{w.title}</h3>
                  <p className="muted">{w.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="home-section">
          <h2 className="section-title">Success stories</h2>
          <div className="story-grid">
            {STORIES.map((s) => (
              <figure className="story" key={s.name}>
                <span className="story__stat">{s.stat}</span>
                <blockquote>“{s.quote}”</blockquote>
                <figcaption>
                  <strong>{s.name}</strong> · <span className="muted">{s.role}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="home-section">
          <h2 className="section-title">Gallery</h2>
          <div className="gallery">
            {GALLERY.map((g, i) => (
              <figure className="gallery__item" key={g.caption}>
                {g.src ? (
                  <img src={g.src} alt={g.caption} loading="lazy" />
                ) : (
                  <div className={`gallery__placeholder gallery__placeholder--${i % 3}`}>
                    <span>Photo coming soon</span>
                  </div>
                )}
                <figcaption>{g.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="home-section" ref={formRef}>
          <div className="card interest-card">
            <h2 className="section-title mt-0">Interested in joining?</h2>
            <p className="muted">Leave your details and the class admin will get back to you with dates and next steps.</p>
            <InterestForm />
          </div>
        </section>
      </main>
      <footer className="site-footer">Hifz Class</footer>
    </div>
  )
}
