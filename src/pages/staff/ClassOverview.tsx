import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ErrorBanner, LoadingState } from '../../components/LoadingAndEmpty'
import { getClassOverview } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { ClassOverviewRow } from '../../lib/types'

export default function ClassOverview() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<ClassOverviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    getClassOverview(session.token)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the class overview.'))
      .finally(() => setLoading(false))
  }, [session])

  if (loading) return <LoadingState />
  if (error) return <ErrorBanner text={error} />

  return (
    <div className="card">
      <h2 className="mt-0">Class overview</h2>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>New Hifz</th>
              <th>Old Hifz</th>
              <th>Attendance</th>
              <th>Good weeks</th>
              <th>Last recorded</th>
              <th>On track</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.student_id} onClick={() => navigate(`/staff/student/${r.student_id}`)} style={{ cursor: 'pointer' }}>
                <td>
                  {r.first_name} {r.last_name}
                </td>
                <td>{r.new_hifz_total}</td>
                <td>{r.old_hifz_total}</td>
                <td>{r.attendance_pct}%</td>
                <td>{r.good_weeks}</td>
                <td>{r.last_recorded_week ?? '—'}</td>
                <td>
                  {r.on_track === null ? (
                    '—'
                  ) : (
                    <span className={`pill ${r.on_track ? 'pill--ontrack' : 'pill--behind'}`}>
                      {r.on_track ? 'On track' : 'Behind'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
