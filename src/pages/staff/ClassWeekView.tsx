import { useCallback, useEffect, useState } from 'react'
import RecordEditSheet from '../../components/RecordEditSheet'
import { ErrorBanner, LoadingState } from '../../components/LoadingAndEmpty'
import { getStudentGrid, getWeekRoster, saveWeeklyRecord } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatUKDate, getCurrentWeekNumber, weekByNumber } from '../../lib/dates'
import type { RecordField, WeekRosterRow, WeeklyRecord } from '../../lib/types'

const WEEK_NUMBERS = Array.from({ length: 10 }, (_, i) => i + 1)

export default function ClassWeekView() {
  const { session } = useAuth()
  const [weekNumber, setWeekNumber] = useState(1)
  const [roster, setRoster] = useState<WeekRosterRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [weekDate, setWeekDate] = useState('')
  const [editing, setEditing] = useState<{
    studentId: string
    label: string
    fields: RecordField[]
    record?: WeeklyRecord
  } | null>(null)

  useEffect(() => {
    // Default to the current week once we know the course schedule.
    if (!session) return
    getStudentGridAny(session.token).then((weeks) => {
      if (weeks) setWeekNumber(getCurrentWeekNumber(weeks))
    })
  }, [session])

  async function getStudentGridAny(token: string) {
    try {
      const roster0 = await getWeekRoster(token, 1)
      if (roster0.length === 0) return null
      const bundle = await getStudentGrid(token, roster0[0].student_id)
      setWeekDate(bundle.weeks[0]?.class_date ?? '')
      return bundle.weeks
    } catch {
      return null
    }
  }

  const loadRoster = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError(null)
    try {
      const rows = await getWeekRoster(session.token, weekNumber)
      setRoster(rows)
      if (rows.length > 0) {
        const bundle = await getStudentGrid(session.token, rows[0].student_id)
        const w = weekByNumber(bundle.weeks, weekNumber)
        setWeekDate(w?.class_date ?? '')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the roster.')
    } finally {
      setLoading(false)
    }
  }, [session, weekNumber])

  useEffect(() => {
    loadRoster()
  }, [loadRoster])

  async function openStudent(row: WeekRosterRow) {
    if (!session) return
    const bundle = await getStudentGrid(session.token, row.student_id)
    setEditing({
      studentId: row.student_id,
      label: `${row.first_name} ${row.last_name}`,
      fields: bundle.fields,
      record: bundle.records.find((r) => r.week_number === weekNumber),
    })
  }

  async function openNextUnrecorded(afterStudentId: string) {
    if (!session) return
    const freshRoster = await getWeekRoster(session.token, weekNumber)
    const idx = freshRoster.findIndex((r) => r.student_id === afterStudentId)
    const rest = [...freshRoster.slice(idx + 1), ...freshRoster.slice(0, idx + 1)]
    const next = rest.find((r) => !r.has_record) ?? rest.find((r) => r.student_id !== afterStudentId)
    if (next) {
      await openStudent(next)
    } else {
      setEditing(null)
    }
  }

  const recordedCount = roster.filter((r) => r.has_record).length

  return (
    <div>
      <div className="card">
        <div className="flex-between flex-wrap gap-2">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="week-select">Week</label>
            <select id="week-select" value={weekNumber} onChange={(e) => setWeekNumber(Number(e.target.value))}>
              {WEEK_NUMBERS.map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>
          <div>
            <strong>{weekDate && formatUKDate(weekDate)}</strong>
            <p className="muted mt-0">
              {recordedCount} of {roster.length} recorded
            </p>
          </div>
        </div>
      </div>

      {error && <ErrorBanner text={error} />}
      {loading ? (
        <LoadingState />
      ) : (
        <div className="card">
          <ul className="search-results">
            {roster.map((row) => (
              <li key={row.student_id}>
                <button type="button" onClick={() => openStudent(row)}>
                  <span className="flex-between">
                    <span>
                      {row.first_name} {row.last_name}
                    </span>
                    <span>
                      {row.has_record ? (
                        row.status === 'absent' ? (
                          <span className="cell-tag cell-tag--absent">Absent</span>
                        ) : row.good_week ? (
                          <span className="cell-tag cell-tag--good">Good week ✓</span>
                        ) : (
                          '✓ Recorded'
                        )
                      ) : (
                        <span className="muted">Not done</span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing && (
        <RecordEditSheet
          studentLabel={editing.label}
          weekNumber={weekNumber}
          weekDate={weekDate}
          fields={editing.fields}
          existingRecord={editing.record}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (!session) return
            await saveWeeklyRecord(session.token, {
              studentId: editing.studentId,
              weekNumber,
              status: data.status,
              goodWeek: data.goodWeek,
              values: data.values,
              note: data.note,
              nextAssignment: data.nextAssignment,
            })
            setEditing(null)
            await loadRoster()
          }}
          onSaveAndNext={async (data) => {
            if (!session) return
            await saveWeeklyRecord(session.token, {
              studentId: editing.studentId,
              weekNumber,
              status: data.status,
              goodWeek: data.goodWeek,
              values: data.values,
              note: data.note,
              nextAssignment: data.nextAssignment,
            })
            await loadRoster()
            await openNextUnrecorded(editing.studentId)
          }}
        />
      )}
    </div>
  )
}
