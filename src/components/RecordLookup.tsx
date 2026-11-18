import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorBanner } from './LoadingAndEmpty'
import { getStudentRecord, searchStudentsPublic } from '../lib/api'
import { saveStudentSession } from '../lib/session'
import type { StudentPublic } from '../lib/types'

/**
 * Parent / student lookup: type a first name, tap the right name, enter the
 * student code. Used on the front page and on the My Record page.
 */
export default function RecordLookup({ title }: { title: string }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentPublic[]>([])
  const [selected, setSelected] = useState<StudentPublic | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const debounceRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        setResults(await searchStudentsPublic(query.trim()))
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
      const trimmed = code.trim().toUpperCase()
      await getStudentRecord(selected.id, trimmed)
      saveStudentSession({ studentId: selected.id, code: trimmed })
      navigate(`/record/${selected.id}`)
    } catch {
      setError('That code did not match. Please check it and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h2 className="mt-0">{title}</h2>
      {!selected && (
        <div className="field">
          <label htmlFor="record-search">Student's first name</label>
          <input
            id="record-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a first name…"
            autoComplete="off"
          />
          {results.length > 0 && (
            <ul className="search-results">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelected(r)}>
                    {r.first_name} {r.last_initial}.<span className="muted"> &middot; {r.course_name}</span>
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
            Hello, <strong>{selected.first_name} {selected.last_initial}.</strong> Enter the student code to view the
            record.
          </p>
          <div className="field">
            <label htmlFor="record-code">Student code</label>
            <input
              id="record-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="HZ-1234"
              autoComplete="off"
              autoCapitalize="characters"
              required
            />
            <p className="field-hint">The teacher gave you this code. Ask them if you've lost it.</p>
          </div>
          {error && <ErrorBanner text={error} />}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Checking…' : 'View record'}
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
  )
}
