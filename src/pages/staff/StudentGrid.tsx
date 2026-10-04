import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import WeeklyGrid from '../../components/WeeklyGrid'
import StudentSummary from '../../components/StudentSummary'
import RecordEditSheet from '../../components/RecordEditSheet'
import { LoadingState, ErrorBanner } from '../../components/LoadingAndEmpty'
import { getStudentGrid, saveWeeklyRecord, staffSearchStudents } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { getCurrentWeekNumber, weekByNumber } from '../../lib/dates'
import type { StudentRecordBundle } from '../../lib/types'

export default function StudentGrid() {
  const { studentId } = useParams<{ studentId: string }>()
  const { session } = useAuth()
  const navigate = useNavigate()
  const [bundle, setBundle] = useState<StudentRecordBundle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingWeek, setEditingWeek] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!session || !studentId) return
    try {
      const data = await getStudentGrid(session.token, studentId)
      setBundle(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this student.')
    }
  }, [session, studentId])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <ErrorBanner text={error} />
  if (!bundle) return <LoadingState />

  const currentWeek = getCurrentWeekNumber(bundle.weeks)
  const { student } = bundle

  async function goToNextStudent() {
    if (!session) return
    const list = await staffSearchStudents(session.token, '')
    const idx = list.findIndex((s) => s.id === student.id)
    const next = list[(idx + 1) % list.length]
    if (next) navigate(`/staff/student/${next.id}`)
  }

  return (
    <div>
      <div className="flex-between" style={{ marginBottom: '1rem' }}>
        <div>
          <h2 className="mt-0">
            {student.first_name} {student.last_name}
          </h2>
          <p className="muted">{student.student_code}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditingWeek(currentWeek)}>
          Fill week {currentWeek}
        </button>
      </div>

      <StudentSummary bundle={bundle} />

      <div className="card">
        <h3>Weekly grid</h3>
        <WeeklyGrid
          fields={bundle.fields}
          weeks={bundle.weeks}
          records={bundle.records}
          joinWeek={student.join_week}
          currentWeek={currentWeek}
          onWeekClick={(wn) => setEditingWeek(wn)}
        />
      </div>

      {editingWeek !== null && (
        <RecordEditSheet
          studentLabel={`${student.first_name} ${student.last_name}`}
          weekNumber={editingWeek}
          weekDate={weekByNumber(bundle.weeks, editingWeek)?.class_date ?? ''}
          fields={bundle.fields}
          existingRecord={bundle.records.find((r) => r.week_number === editingWeek)}
          onClose={() => setEditingWeek(null)}
          onSave={async (data) => {
            if (!session || !studentId) return
            await saveWeeklyRecord(session.token, {
              studentId,
              weekNumber: editingWeek,
              status: data.status,
              goodWeek: data.goodWeek,
              values: data.values,
              note: data.note,
              nextAssignment: data.nextAssignment,
            })
            await load()
          }}
          onSaveAndNext={async (data) => {
            if (!session || !studentId) return
            await saveWeeklyRecord(session.token, {
              studentId,
              weekNumber: editingWeek,
              status: data.status,
              goodWeek: data.goodWeek,
              values: data.values,
              note: data.note,
              nextAssignment: data.nextAssignment,
            })
            setEditingWeek(null)
            await goToNextStudent()
          }}
        />
      )}
    </div>
  )
}
