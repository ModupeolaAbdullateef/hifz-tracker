import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { staffSearchStudents } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { StudentFull } from '../../lib/types'

export default function FindStudent() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StudentFull[]>([])
  const debounceRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    if (!session) return
    debounceRef.current = window.setTimeout(async () => {
      try {
        const rows = await staffSearchStudents(session.token, query.trim())
        setResults(rows)
      } catch {
        setResults([])
      }
    }, 200)
    return () => window.clearTimeout(debounceRef.current)
  }, [query, session])

  return (
    <div className="card">
      <h2>Find a student</h2>
      <div className="field">
        <label htmlFor="staff-search">Student name</label>
        <input
          id="staff-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing…"
          autoFocus
        />
      </div>
      {results.length > 0 && (
        <ul className="search-results">
          {results.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => navigate(`/staff/student/${s.id}`)}>
                {s.first_name} {s.last_name}
                <span className="muted"> &middot; {s.student_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim().length > 0 && results.length === 0 && <p className="field-hint">No students found.</p>}
    </div>
  )
}
