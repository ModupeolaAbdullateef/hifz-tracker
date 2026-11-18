import { useCallback, useEffect, useState } from 'react'
import AdminGuard from '../../../components/AdminGuard'
import { ErrorBanner, LoadingState, SuccessBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import { getAudit, undoAudit } from '../../../hifdh/api'
import { useTerm } from '../../../hifdh/TermContext'
import type { AuditEntry } from '../../../hifdh/types'

function describe(v: Record<string, unknown> | null): string {
  if (!v) return '(empty)'
  if ('value' in v) return [v.value, v.initials].filter(Boolean).join(' ') || '(empty)'
  if ('text' in v) return (v.text as string) || '(empty)'
  if ('absent' in v) return v.absent ? 'Absent' : 'Present'
  if ('status' in v) return String(v.status)
  if ('display_name' in v) return `${v.display_name} (${v.code})`
  return JSON.stringify(v)
}

/** A10: who changed what and when, with undo for results, targets and attendance. */
export default function Audit() {
  const { session } = useAuth()
  const { view, reloadTerm } = useTerm()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [studentId, setStudentId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      setEntries(await getAudit(session.token, 300, studentId || null))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the audit trail.')
    } finally {
      setLoading(false)
    }
  }, [session, studentId])

  useEffect(() => {
    void load()
  }, [load])

  const undoable = (e: AuditEntry) => ['result', 'target', 'attendance'].includes(e.entity)

  return (
    <AdminGuard>
      <div className="card">
        <div className="flex-between flex-wrap gap-2">
          <h2 className="mt-0">Audit trail</h2>
          <select aria-label="Filter by student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Everyone</option>
            {view?.students.map((s) => (
              <option key={s.student.id} value={s.student.id}>
                {s.student.display_name}
              </option>
            ))}
          </select>
        </div>
        <p className="field-hint">Every change to targets, results and attendance is kept. Undo puts the box back to what it was before that change.</p>
        {error && <ErrorBanner text={error} />}
        {message && <SuccessBanner text={message} />}
        {loading ? (
          <LoadingState />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Who</th>
                  <th>Student</th>
                  <th>What</th>
                  <th>Before</th>
                  <th>After</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.at).toLocaleString('en-GB', { timeZone: 'Europe/London', dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{e.actor}</td>
                    <td>{e.student_name ?? '—'}</td>
                    <td>
                      {e.entity}
                      {e.line_label ? ` · ${e.line_label}` : ''}
                      {'week' in e.entity_key ? ` · week ${String(e.entity_key.week)}` : ''}
                      {e.entity_key.field === 'override' ? ' (revise this week)' : ''}
                    </td>
                    <td>{describe(e.before)}</td>
                    <td>{describe(e.after)}</td>
                    <td>
                      {undoable(e) && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={async () => {
                            if (!session) return
                            setError(null)
                            try {
                              await undoAudit(session.token, e.id)
                              setMessage('Undone.')
                              await Promise.all([load(), reloadTerm()])
                            } catch (err) {
                              setError(err instanceof Error ? err.message : 'Could not undo.')
                            }
                          }}
                        >
                          Undo
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}
