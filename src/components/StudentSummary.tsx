import ProgressRing from './ProgressRing'
import StatCard from './StatCard'
import BarChart from './BarChart'
import BadgeRow from './BadgeRow'
import TeacherNotes from './TeacherNotes'
import type { StudentRecordBundle } from '../lib/types'

/**
 * The full progress breakdown (totals, target ring, per-week chart, teacher
 * notes, badges). Shared by the student's own record page and the staff view
 * of a student so both see exactly the same picture.
 */
export default function StudentSummary({
  bundle,
  emptyText = 'No weeks recorded yet.',
}: {
  bundle: StudentRecordBundle
  emptyText?: string
}) {
  const { student, course, totals, badges } = bundle
  const hasTarget = !!(student.target_pages ?? course.target_pages)
  const target = student.target_pages ?? course.target_pages ?? 0

  if (totals.weeks_recorded === 0) {
    return (
      <div className="card">
        <p className="mt-0">{emptyText}</p>
      </div>
    )
  }

  const chartData = bundle.weeks
    .filter((w) => !w.cancelled)
    .map((w) => {
      const rec = bundle.records.find((r) => r.week_number === w.week_number)
      const val = rec && rec.status === 'present' ? Number(rec.values?.new_hifz ?? 0) : 0
      return { label: `W${w.week_number}`, value: val }
    })

  return (
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

      <div className="card">
        <h3>Teacher notes</h3>
        <TeacherNotes records={bundle.records} weeks={bundle.weeks} />
      </div>

      <div className="card">
        <h3>Badges</h3>
        <BadgeRow badges={badges} />
      </div>
    </>
  )
}
