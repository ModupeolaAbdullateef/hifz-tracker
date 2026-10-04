import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getStudentRecord } from '../../lib/api'
import { loadStudentSession } from '../../lib/session'
import { LoadingState } from '../../components/LoadingAndEmpty'
import type { StudentRecordBundle } from '../../lib/types'

export default function Certificate() {
  const { studentId } = useParams<{ studentId: string }>()
  const [bundle, setBundle] = useState<StudentRecordBundle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!studentId) return
    const session = loadStudentSession()
    if (!session || session.studentId !== studentId) {
      setError('Please open your record from the home page first.')
      return
    }
    getStudentRecord(studentId, session.code)
      .then(setBundle)
      .catch(() => setError('Could not load your record.'))
  }, [studentId])

  if (error) {
    return (
      <main className="page page--narrow">
        <p className="error-banner">{error}</p>
        <Link to="/">Back to home</Link>
      </main>
    )
  }

  if (!bundle) {
    return (
      <main className="page">
        <LoadingState />
      </main>
    )
  }

  const { student, totals, course } = bundle
  const today = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'long' }).format(new Date())

  return (
    <main className="page">
      <div className="no-print flex-between" style={{ marginBottom: '1rem' }}>
        <Link to={`/record/${student.id}`} className="btn btn-ghost">
          Back to progress
        </Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print certificate
        </button>
      </div>
      <div className="certificate">
        <p className="arabic" style={{ fontSize: '1.4rem' }}>
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>
        <h1>Certificate of Achievement</h1>
        <p className="muted">Tystysgrif Cyflawniad</p>
        <p>This certifies that</p>
        <p className="student-name">
          {student.first_name} {student.last_name}
        </p>
        <p>
          has memorised <strong>{totals.new_hifz_total} pages</strong> of new Hifz during the {course.name},
          with {totals.good_weeks} good week{totals.good_weeks === 1 ? '' : 's'} and attendance of{' '}
          {totals.weeks_present}/{totals.weeks_recorded} weeks.
        </p>
        <p className="muted">Awarded on {today}</p>
        <p className="muted" style={{ marginTop: '2rem' }}>
          Mosg Abertawe &middot; Swansea Mosque
        </p>
      </div>
    </main>
  )
}
