import { useState } from 'react'
import AdminGuard from '../../../components/AdminGuard'
import { EmptyState, ErrorBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import { setPaid } from '../../../hifdh/api'
import { useTerm } from '../../../hifdh/TermContext'

/** A8: who is registered this term and whether they have paid. */
export default function Registration() {
  const { session } = useAuth()
  const { view, term, group, reloadTerm } = useTerm()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  if (!term || !view) return <EmptyState text="No term selected." />
  const paid = view.students.filter((s) => s.student.paid).length

  async function toggle(studentId: string, value: boolean) {
    if (!session || !term) return
    setBusy(studentId)
    setError(null)
    try {
      await setPaid(session.token, term.id, studentId, value)
      await reloadTerm()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <AdminGuard>
      <div className="card">
        <div className="flex-between flex-wrap gap-2">
          <h2 className="mt-0">
            Registration · {group?.name} · {term.name}
          </h2>
          <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>
            Print
          </button>
        </div>
        <p className="muted">
          {view.students.length} registered · <strong>{paid} paid</strong> · {view.students.length - paid} not paid yet
        </p>
        {error && <ErrorBanner text={error} />}
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {view.students.map((sv) => (
                <tr key={sv.student.id}>
                  <td>{sv.student.code}</td>
                  <td className={sv.student.is_teacher ? 'teacher-name' : ''}>{sv.student.display_name}</td>
                  <td>{sv.student.status}</td>
                  <td>
                    <button
                      className={`chip ${sv.student.paid ? 'chip--paid' : 'chip--unpaid'}`}
                      style={{ border: 'none', cursor: 'pointer', minHeight: 32, minWidth: 48 }}
                      disabled={busy === sv.student.id}
                      aria-pressed={sv.student.paid}
                      onClick={() => toggle(sv.student.id, !sv.student.paid)}
                    >
                      {sv.student.paid ? 'Y' : 'N'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="field-hint no-print">Tap Y / N to change. To register someone, add them to this term on the Students tab.</p>
      </div>
    </AdminGuard>
  )
}
