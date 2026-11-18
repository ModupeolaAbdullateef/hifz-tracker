import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/LoadingAndEmpty'
import { formatUKDate } from '../../lib/dates'
import { currentWeekNumber, isRevisionLine } from '../../hifdh/rules'
import { useTerm } from '../../hifdh/TermContext'

interface Item {
  id: string
  name: string
  detail?: string
}

export default function ThisWeek() {
  const { view, term, today } = useTerm()
  const weeks = view?.payload.weeks ?? []
  const [week, setWeek] = useState<number | null>(null)

  useEffect(() => {
    if (weeks.length && week === null) setWeek(currentWeekNumber(weeks, today))
  }, [weeks, week, today])

  if (!term || !view || week === null) return <EmptyState text="No term selected." />

  const behind: Item[] = []
  const absent: Item[] = []
  const revisionNotDone: Item[] = []
  const testsDue: Item[] = []
  const testResults: Item[] = []

  for (const sv of view.students) {
    const id = sv.student.id
    const name = sv.student.display_name
    if (sv.totals.status === 'Behind') {
      behind.push({ id, name, detail: `${sv.totals.totalMemorised} of ${sv.totals.expectedByNow} expected` })
    }
    if (sv.absentWeeks.has(week)) absent.push({ id, name, detail: sv.exceptionWeeks.has(week) ? 'excused' : undefined })
    for (const line of sv.lines) {
      const c = sv.cells.get(line.id)?.find((x) => x.week === week)
      if (!c || c.cancelled) continue
      if (isRevisionLine(line) && c.target && !c.isTest && (c.kind === 'N' || (c.passed && c.kind === 'empty'))) {
        revisionNotDone.push({ id, name, detail: `${line.label}: ${c.target}${c.kind === 'N' ? ' (N)' : ''}` })
      }
      if (c.isTest && (c.kind === 'empty' || c.kind === 'absent')) testsDue.push({ id, name, detail: c.target ?? '' })
      if (c.isTest && (c.kind === 'pass' || c.kind === 'fail')) {
        testResults.push({
          id,
          name,
          detail: `${c.target}: ${c.result?.value}${c.result?.initials ? ` (${c.result.initials})` : ''}${c.result?.note ? ` · ${c.result.note}` : ''}`,
        })
      }
    }
  }

  return (
    <div>
      <div className="flex-between flex-wrap gap-2">
        <h2 className="mt-0">This week</h2>
        <select aria-label="Week" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
          {weeks.map((w) => (
            <option key={w.week_number} value={w.week_number}>
              Week {w.week_number} · {formatUKDate(w.class_date)}
            </option>
          ))}
        </select>
      </div>
      <div className="summary-grid">
        <SummaryList title="Behind" items={behind} empty="Everyone is on track." />
        <SummaryList title="Absent" items={absent} empty="Nobody marked absent." />
        <SummaryList title="Revision not done" items={revisionNotDone} empty="All revision done (or not yet due)." />
        <SummaryList title="Juz tests due" items={testsDue} empty="No tests due." />
        <SummaryList title="Test results" items={testResults} empty="No test results this week." />
      </div>
    </div>
  )
}

function SummaryList({ title, items, empty }: { title: string; items: Item[]; empty: string }) {
  return (
    <div className="card">
      <h3 className="mt-0">
        {title} <span className="chip">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="muted">{empty}</p>
      ) : (
        <ul>
          {items.map((i, idx) => (
            <li key={`${i.id}-${idx}`}>
              <Link to={`/staff/student/${i.id}`}>{i.name}</Link>
              {i.detail && <span className="muted"> · {i.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
