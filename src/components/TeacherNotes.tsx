import { formatUKDate } from '../lib/dates'
import type { CourseWeek, WeeklyRecord } from '../lib/types'

/** Every teacher note / next assignment for a student, newest week first, with who wrote it. */
export default function TeacherNotes({ records, weeks }: { records: WeeklyRecord[]; weeks: CourseWeek[] }) {
  const notes = records
    .filter((r) => r.note || r.next_assignment)
    .sort((a, b) => b.week_number - a.week_number)

  if (notes.length === 0) {
    return <p className="muted">No notes from the teacher yet.</p>
  }

  const dateByWeek = new Map(weeks.map((w) => [w.week_number, w.class_date]))

  return (
    <ol className="note-list">
      {notes.map((r, i) => {
        const author = r.note_by ?? r.updated_by ?? r.created_by
        const date = dateByWeek.get(r.week_number)
        return (
          <li key={r.week_number} className="note">
            <div className="note__head">
              <span className="note__week">Week {r.week_number}</span>
              {date && <span className="muted">{formatUKDate(date)}</span>}
              {i === 0 && <span className="pill pill--ontrack">Latest</span>}
            </div>
            {r.note && <p className="note__text">{r.note}</p>}
            {r.next_assignment && (
              <p className="note__assignment">
                <strong>Next assignment:</strong> {r.next_assignment}
              </p>
            )}
            {author && <p className="note__author">— {author}</p>}
          </li>
        )
      })}
    </ol>
  )
}
