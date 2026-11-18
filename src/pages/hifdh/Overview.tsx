import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/LoadingAndEmpty'
import { formatUKDate } from '../../lib/dates'
import { AttendanceText, ColourLegend, colourClass, doneText, StatusText } from '../../hifdh/components'
import { doneRowLabel, type StudentView } from '../../hifdh/model'
import { currentWeekNumber, isRevisionLine, type CellColour, type Week } from '../../hifdh/rules'
import { useTerm } from '../../hifdh/TermContext'

/** One colour per student per week, for the collapsed row. */
function weekSummaryColour(sv: StudentView, week: number): CellColour {
  if (sv.absentWeeks.has(week)) return sv.exceptionWeeks.has(week) ? 'green' : 'red'
  const cells = sv.lines.filter((l) => l.has_done).map((l) => sv.cells.get(l.id)?.find((c) => c.week === week))
  const colours = cells.filter(Boolean).map((c) => c!.colour)
  if (cells.some((c) => c?.isTest && c.kind === 'empty')) return 'test-due'
  if (colours.includes('red')) return 'red'
  if (colours.includes('amber')) return 'amber'
  if (colours.includes('test-pass')) return 'test-pass'
  if (colours.length && colours.every((c) => c === 'green')) return 'green'
  return 'none'
}

function weekSummaryText(sv: StudentView, week: number): string {
  if (sv.absentWeeks.has(week)) return 'Abs'
  const nh = sv.lines.find((l) => l.type === 'new_hifdh')
  const c = nh ? sv.cells.get(nh.id)?.find((x) => x.week === week) : undefined
  if (!c) return ''
  if (c.kind === 'Y') return c.target ?? 'Y'
  if (c.kind === 'part') return c.result?.value ?? ''
  if (c.kind === 'N') return 'N'
  return ''
}

export default function Overview() {
  const { view, term, today, group } = useTerm()
  const [open, setOpen] = useState<Set<string>>(new Set())

  if (!term || !view) return <EmptyState text="No term selected." />
  if (view.students.length === 0) return <EmptyState text="No students in this term yet." />

  const weeks = view.payload.weeks
  const current = currentWeekNumber(weeks, today)
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="ov-print">
      <div className="flex-between flex-wrap gap-2 no-print" style={{ marginBottom: 8 }}>
        <h2 className="mt-0" style={{ marginBottom: 0 }}>
          Overview · {group?.name} · {term.name}
        </h2>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open.size ? new Set() : new Set(view.students.map((s) => s.student.id)))}>
            {open.size ? 'Collapse all' : 'Expand all'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            Print (one page)
          </button>
        </div>
      </div>
      <h2 className="print-only" style={{ margin: '0 0 4px', fontSize: '12pt' }}>
        {group?.name} Overview · {term.name}
      </h2>

      <div className="hf-grid-wrap">
        <table className="ov-table">
          <thead>
            <tr>
              <th className="ov-name">Name</th>
              {weeks.map((w) => (
                <th key={w.week_number}>
                  {w.week_number}
                  <small>{formatUKDate(w.class_date).slice(0, 5)}</small>
                </th>
              ))}
              <th>Total memorised</th>
              <th>Expected by now</th>
              <th>Total projected</th>
              <th>Status</th>
              <th>Weeks absent</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {view.students.map((sv) => (
              <Fragment key={sv.student.id}>
                <tr className={sv.student.status === 'left' ? 'ov-left' : ''}>
                  <td className="ov-name">
                    <button type="button" onClick={() => toggle(sv.student.id)} aria-expanded={open.has(sv.student.id)}>
                      <span className="no-print" aria-hidden="true">
                        {open.has(sv.student.id) ? '▾ ' : '▸ '}
                      </span>
                      <span className={sv.student.is_teacher ? 'teacher-name' : ''}>{sv.student.display_name}</span>
                    </button>
                    {sv.student.status === 'left' && <span className="chip chip--left">left</span>}
                  </td>
                  {weeks.map((w) => (
                    <td
                      key={w.week_number}
                      className={w.cancelled ? 'cancelled' : colourClass(weekSummaryColour(sv, w.week_number))}
                      style={w.week_number === current ? { outline: '2px solid var(--brand-secondary)', outlineOffset: -2 } : undefined}
                    >
                      {w.cancelled ? '—' : weekSummaryText(sv, w.week_number)}
                    </td>
                  ))}
                  <td>{sv.totals.totalMemorised}</td>
                  <td>{sv.totals.expectedByNow}</td>
                  <td>{sv.totals.totalProjected}</td>
                  <td>
                    <StatusText status={sv.totals.status} />
                  </td>
                  <td>{sv.totals.weeksAbsent}</td>
                  <td>
                    <AttendanceText pct={sv.totals.attendancePct} low={sv.totals.attendanceLow} />
                  </td>
                </tr>
                {open.has(sv.student.id) && <ExpandedLines sv={sv} weeks={weeks} />}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="no-print">
        <ColourLegend />
        <p className="field-hint">Tap a name to see their lines. Teachers are shown in green.</p>
      </div>
    </div>
  )
}

function ExpandedLines({ sv, weeks }: { sv: StudentView; weeks: Week[] }) {
  const extra = 6
  return (
    <>
      <tr className="ov-line">
        <td className="ov-name">Juz</td>
        {weeks.map((w) => (
          <td key={w.week_number}>{sv.juz.get(w.week_number) ?? ''}</td>
        ))}
        <td colSpan={extra}>
          <Link to={`/staff/student/${sv.student.id}`}>Full record →</Link>
        </td>
      </tr>
      {sv.lines
        .filter((l) => l.type !== 'juz')
        .map((line) => {
          const cells = sv.cells.get(line.id) ?? []
          return (
            <Fragment key={line.id}>
              <tr className="ov-line">
                <td className="ov-name">{line.label}</td>
                {cells.map((c) => (
                  <td key={c.week} className={c.cancelled ? 'cancelled' : colourClass(c.targetColour)}>
                    {c.cancelled ? '' : c.target ?? ''}
                  </td>
                ))}
                <td colSpan={extra} />
              </tr>
              {isRevisionLine(line) && (
                <tr className="ov-line">
                  <td className="ov-name">Revise this week</td>
                  {cells.map((c) => (
                    <td key={c.week} className={c.cancelled || c.overridden ? '' : 'c-gold'}>
                      {c.cancelled ? '' : c.target ?? ''}
                    </td>
                  ))}
                  <td colSpan={extra} />
                </tr>
              )}
              {line.has_done && (
                <tr className="ov-line">
                  <td className="ov-name">{doneRowLabel(line)}</td>
                  {cells.map((c) => (
                    <td key={c.week} className={c.cancelled ? 'cancelled' : colourClass(c.colour)}>
                      {c.cancelled ? '' : doneText(c)}
                    </td>
                  ))}
                  <td colSpan={extra} />
                </tr>
              )}
            </Fragment>
          )
        })}
    </>
  )
}
