import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TipsMarquee from '../../components/TipsMarquee'
import SiteHeader from '../../components/SiteHeader'
import PublicNav from '../../components/PublicNav'
import { ErrorBanner } from '../../components/LoadingAndEmpty'
import { getActiveTips, getStudentRecord, searchStudentsPublic } from '../../lib/api'
import { saveStudentSession } from '../../lib/session'
import type { StudentPublic, Tip } from '../../lib/types'

export default function FindRecord() {
  const navigate = useNavigate()
  const [tips, setTips] = useState<Tip[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentPublic[]>([])
  const [selected, setSelected] = useState<StudentPublic | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const debounceRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    getActiveTips().then(setTips).catch(() => setTips([]))
  }, [])

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const rows = await searchStudentsPublic(query.trim())
        setResults(rows)
      } catch {
        setResults([])
      }
    }, 250)
    return () => window.clearTimeout(debounceRef.current)
  }, [query])

  async function handleOpenRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      await getStudentRecord(selected.id, code.trim())
      saveStudentSession({ studentId: selected.id, code: code.trim() })
      navigate(`/record/${selected.id}`)
    } catch {
      setError('That code did not match. Please check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <SiteHeader />
      <TipsMarquee tips={tips} />
      <main className="page page--narrow">
        <PublicNav />
        <div className="card">
          <h2>Find my record / Dod o hyd i fy nghofnod</h2>
          {!selected && (
            <div className="field">
              <label htmlFor="search">Your first name</label>
              <input
                id="search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Start typing your name…"
                autoComplete="off"
              />
              {results.length > 0 && (
                <ul className="search-results">
                  {results.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setSelected(r)}>
                        {r.first_name} {r.last_initial}.
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {query.trim().length >= 2 && results.length === 0 && (
                <p className="field-hint">No matching students found.</p>
              )}
            </div>
          )}

          {selected && (
            <form onSubmit={handleOpenRecord}>
              <p>
                Hello, <strong>{selected.first_name} {selected.last_initial}.</strong> Enter your student code to
                view your record.
              </p>
              <div className="field">
                <label htmlFor="code">Student code</label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="HZ-4821"
                  autoComplete="off"
                  required
                />
                <p className="field-hint">Your teacher gave you this code — ask them if you've lost it.</p>
              </div>
              {error && <ErrorBanner text={error} />}
              <div className="flex gap-2">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Checking…' : 'View my record'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setSelected(null)
                    setCode('')
                    setError(null)
                  }}
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      </main>
      <footer className="site-footer">Hifz Class</footer>
    </div>
  )
}
