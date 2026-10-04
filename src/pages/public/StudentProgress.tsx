import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import TipsMarquee from '../../components/TipsMarquee'
import PublicNav from '../../components/PublicNav'
import WeeklyGrid from '../../components/WeeklyGrid'
import ProgressRing from '../../components/ProgressRing'
import StatCard from '../../components/StatCard'
import BarChart from '../../components/BarChart'
import BadgeRow from '../../components/BadgeRow'
import { ErrorBanner, LoadingState } from '../../components/LoadingAndEmpty'
import { getActiveTips, getStudentRecord } from '../../lib/api'
import { clearStudentSession, loadStudentSession, saveStudentSession } from '../../lib/session'
import { getCurrentWeekNumber } from '../../lib/dates'
import type { StudentRecordBundle, Tip } from '../../lib/types'

export default function StudentProgress() {
  const { studentId } = useParams<{ studentId: string }>()
  const navigate = useNavigate()
  const [bundle, setBundle] = useState<StudentRecordBundle | null>(null)
  const [tips, setTips] = useState<Tip[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [codeInput, setCodeInput] = useState('')
  const [needsCode, setNeedsCode] = useState(false)

  useEffect(() => {
    getActiveTips().then(setTips).catch(() => setTips([]))
  }, [])

  useEffect(() => {
    if (!studentId) return
    const session = loadStudentSession()
    if (!session || session.studentId !== studentId) {
      setNeedsCode(true)
      setLoading(false)
      return
    }
    load(session.code)
  }, [studentId])

  async function load(code: string) {
    if (!studentId) return
    setLoading(true)
    setError(null)
    try {
      const data = await getStudentRecord(studentId, code)
      setBundle(data)
      setNeedsCode(false)
    } catch {
      clearStudentSession()
      setNeedsCode(true)
      setError('That code did not match. Please check it and try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!studentId) return
    saveStudentSession({ studentId, code: codeInput.trim() })
    await load(codeInput.trim())
  }

  if (loading) {
    return (
      <div className="app-shell">
        <SiteHeader />
        <main className="page">
          <LoadingState text="Loading your record…" />
        </main>
      </div>
    )
  }

  if (needsCode || !bundle) {
    return (
      <div className="app-shell">
        <SiteHeader />
        <main className="page page--narrow">
          <div className="card">
            <h2>Enter your student code</h2>
            <form onSubmit={handleCodeSubmit}>
              <div className="field">
                <label htmlFor="code">Student code</label>
                <input
                  id="code"
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="HZ-4821"
                  required
                />
              </div>
              {error && <ErrorBanner text={error} />}
              <button type="submit" className="btn btn-primary btn-block">
                View record
              </button>
            </form>
            <p className="text-center">
              <Link to="/">Back to search</Link>
            </p>
          </div>
        </main>
      </div>
    )
  }

  const currentWeek = getCurrentWeekNumber(bundle.weeks)
  const { student, course, totals, badges } = bundle
  const hasTarget = !!(student.target_pages ?? course.target_pages)
  const target = student.target_pages ?? course.target_pages ?? 0
  const targetReached = hasTarget && totals.new_hifz_total >= target
  const courseFinished = currentWeek >= course.weeks
  const canCertificate = courseFinished || targetReached

  const chartData = bundle.weeks
    .filter((w) => !w.cancelled)
    .map((w) => {
      const rec = bundle.records.find((r) => r.week_number === w.week_number)
      const val = rec && rec.status === 'present' ? Number(rec.values?.new_hifz ?? 0) : 0
      return { label: `W${w.week_number}`, value: val }
    })

  const latestWithNote = [...bundle.records]
    .filter((r) => r.note || r.next_assignment)
    .sort((a, b) => b.week_number - a.week_number)[0]

  return (
    <div className="app-shell">
      <SiteHeader />
      <TipsMarquee tips={tips} />
      <main className="page">
        <PublicNav />
        <div className="flex-between">
          <h2 className="mt-0">
            {student.first_name} {student.last_name}'s Progress / Fy Nghynnydd
          </h2>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              clearStudentSession()
              navigate('/')
            }}
          >
            Exit
          </button>
        </div>

        {totals.weeks_recorded === 0 ? (
          <div className="card">
            <p>No weeks recorded yet — your journey starts on Thursday 15 October, in sha Allah.</p>
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <StatCard value={totals.new_hifz_total} label="New Hifz total" />
              <StatCard value={totals.old_hifz_total} label="Old Hifz total" />
              <StatCard value={`${totals.weeks_present}/${totals.weeks_recorded}`} label="Attendance" />
              <StatCard value={totals.good_weeks} label="Good weeks" />
            </div>

            {hasTarget && (
              <div className="card text-center">
                <ProgressRing value={totals.new_hifz_total} target={target} label="New Hifz vs target (pages)" />
              </div>
            )}

            <div className="card">
              <h3>New Hifz per week</h3>
              <BarChart data={chartData} unit="pages" />
            </div>

            {latestWithNote && (
              <div className="card">
                <h3>Latest note</h3>
                {latestWithNote.note && <p>{latestWithNote.note}</p>}
                {latestWithNote.next_assignment && (
                  <p>
                    <strong>Next assignment:</strong> {latestWithNote.next_assignment}
                  </p>
                )}
              </div>
            )}

            <div className="card">
              <h3>Badges</h3>
              <BadgeRow badges={badges} />
            </div>
          </>
        )}

        <div className="card">
          <h3>Weekly grid</h3>
          <WeeklyGrid
            fields={bundle.fields}
            weeks={bundle.weeks}
            records={bundle.records}
            joinWeek={student.join_week}
            currentWeek={currentWeek}
          />
        </div>

        {canCertificate && (
          <div className="card text-center">
            <Link to={`/certificate/${student.id}`} className="btn btn-secondary">
              View certificate
            </Link>
          </div>
        )}
      </main>
      <footer className="site-footer">Hifz Class</footer>
    </div>
  )
}
