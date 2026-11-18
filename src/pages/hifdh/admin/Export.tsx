import { useState } from 'react'
import { Link } from 'react-router-dom'
import AdminGuard from '../../../components/AdminGuard'
import { EmptyState, ErrorBanner } from '../../../components/LoadingAndEmpty'
import { downloadWorkbook } from '../../../hifdh/exportExcel'
import { useTerm } from '../../../hifdh/TermContext'

/** A9: export the Overview and student records to Excel or PDF. */
export default function Export() {
  const { view, term, group } = useTerm()
  const [studentId, setStudentId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!view || !term) return <EmptyState text="No term selected." />

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  const groupName = group?.name ?? ''

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">
          Export · {groupName} · {term.name}
        </h2>
        <h3>Overview</h3>
        <div className="flex gap-2 flex-wrap">
          <button className="btn btn-primary" disabled={busy} onClick={() => run(() => downloadWorkbook(view, groupName, [], true))}>
            Overview to Excel
          </button>
          <Link className="btn btn-secondary" to="/staff/overview">
            Overview to PDF (open, then Print)
          </Link>
          <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => downloadWorkbook(view, groupName, 'all', true))}>
            Everything to Excel (Overview + every student)
          </button>
        </div>
        <p className="field-hint">The printed Overview fits on one landscape page and shows name lines only.</p>

        <h3>One student</h3>
        <div className="flex gap-2 flex-wrap" style={{ alignItems: 'center' }}>
          <select aria-label="Student" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Pick a student</option>
            {view.students.map((s) => (
              <option key={s.student.id} value={s.student.id}>
                {s.student.display_name} ({s.student.code})
              </option>
            ))}
          </select>
          <button className="btn btn-primary" disabled={!studentId || busy} onClick={() => run(() => downloadWorkbook(view, groupName, [studentId], false))}>
            Record to Excel
          </button>
          {studentId && (
            <Link className="btn btn-secondary" to={`/staff/student/${studentId}`}>
              Record to PDF (open, then Print)
            </Link>
          )}
        </div>
        {error && <ErrorBanner text={error} />}
      </div>
    </AdminGuard>
  )
}
