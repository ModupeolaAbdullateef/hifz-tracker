import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, ErrorBanner } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'
import { formatUKDate } from '../../lib/dates'
import { colourClass, ColourLegend } from '../../hifdh/components'
import { selfCheckKey, type StudentView } from '../../hifdh/model'
import { currentWeekNumber, isRevisionLine, testJuz, type Line, type WeekCell } from '../../hifdh/rules'
import { useTerm } from '../../hifdh/TermContext'

export default function Record() {
  const { isAdmin } = useAuth()
  const { view, term, today, initials, setInitials } = useTerm()
  const weeks = view?.payload.weeks ?? []
  const [week, setWeek] = useState<number | null>(null)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (weeks.length && week === null) setWeek(currentWeekNumber(weeks, today))
  }, [weeks, week, today])

  const students = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (view?.students ?? []).filter((s) => !q || s.student.display_name.toLowerCase().includes(q) || s.student.code.toLowerCase().includes(q))
  }, [view, filter])

  if (!term) {
    return <EmptyState text={isAdmin ? 'No term yet. Create one on the Terms tab.' : 'No term has been set up for your group yet.'} />
  }
  if (!view || week === null) return null
  if (view.students.length === 0) {
    return <EmptyState text={isAdmin ? 'No students in this term yet. Add them on the Students tab or import the Excel sheets.' : 'No students in this term yet.'} />
  }

  const wk = weeks.find((w) => w.week_number === week)
  const done = view.students.filter((s) => isRecorded(s, week)).length

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div>
      <div className="rec-toolbar no-print">
        <div className="field">
          <label htmlFor="rec-week">Week</label>
          <select id="rec-week" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
            {weeks.map((w) => (
              <option key={w.week_number} value={w.week_number}>
                Week {w.week_number} · {formatUKDate(w.class_date)}
                {w.cancelled ? ' (no class)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="rec-initials">Initials</label>
          <input
            id="rec-initials"
            className="rec-initials"
            value={initials}
            maxLength={4}
            onChange={(e) => setInitials(e.target.value.toUpperCase())}
            title="Added to each result. Change it if someone else tested."
          />
        </div>
        <div className="field" style={{ flex: 1, minWidth: 140 }}>
          <label htmlFor="rec-filter">Find</label>
          <input id="rec-filter" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name or ID" />
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setOpen(open.size ? new Set() : new Set(students.map((s) => s.student.id)))}
        >
          {open.size ? 'Close all' : 'Open all'}
        </button>
      </div>

      <p className="muted" style={{ margin: '4px 0 8px' }}>
        {done} of {view.students.length} recorded for week {week}
        {wk?.cancelled && ' · this week is cancelled (no class)'}
      </p>
      {error && <ErrorBanner text={error} />}

      {students.map((sv) => (
        <StudentCard
          key={sv.student.id}
          sv={sv}
          week={week}
          open={open.has(sv.student.id)}
          onToggle={() => toggle(sv.student.id)}
          onError={setError}
        />
      ))}
      <ColourLegend />
    </div>
  )
}

function isRecorded(sv: StudentView, week: number): boolean {
  if (sv.absentWeeks.has(week)) return true
  const doneLines = sv.lines.filter((l) => l.has_done)
  return doneLines.length > 0 && doneLines.some((l) => sv.cells.get(l.id)?.find((c) => c.week === week)?.result)
}

function StudentCard({
  sv,
  week,
  open,
  onToggle,
  onError,
}: {
  sv: StudentView
  week: number
  open: boolean
  onToggle: () => void
  onError: (e: string | null) => void
}) {
  const { setAbsent } = useTerm()
  const absent = sv.absentWeeks.has(week)
  const juz = sv.juz.get(week)
  const doneLines = sv.lines.filter((l) => l.has_done)

  async function run(fn: () => Promise<void>) {
    onError(null)
    try {
      await fn()
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  return (
    <div className="rec-student">
      <div className="rec-student__head">
        <button type="button" className="rec-student__name" onClick={onToggle} aria-expanded={open}>
          <span className={sv.student.is_teacher ? 'teacher-name' : ''}>{sv.student.display_name}</span>
          {sv.student.status === 'left' && <span className="chip chip--left"> left</span>}
          <span className="rec-student__summary">
            {sv.student.code}
            {juz ? ` · Juz ${juz}` : ''}
            {sv.partners.length > 0 ? ` · partner: ${sv.partners.join(' & ')}` : ''}
          </span>
        </button>
        <span className="rec-dots" aria-hidden="true">
          {doneLines.map((l) => {
            const c = sv.cells.get(l.id)?.find((x) => x.week === week)
            return <span key={l.id} className={`rec-dot ${c ? colourClass(c.colour) : ''}`} />
          })}
        </span>
        <button
          type="button"
          className={`btn btn-sm rec-absent-btn ${absent ? 'is-on' : 'btn-ghost'}`}
          aria-pressed={absent}
          onClick={() => run(() => setAbsent(sv.student.id, week, !absent))}
        >
          Absent
        </button>
      </div>
      {open && !absent && (
        <div>
          {sv.lines.map((line) => {
            const cell = sv.cells.get(line.id)?.find((c) => c.week === week)
            if (!cell) return null
            return <LineRow key={line.id} sv={sv} line={line} cell={cell} week={week} run={run} />
          })}
          <div className="rec-line">
            <Link to={`/staff/student/${sv.student.id}`} className="btn btn-ghost btn-sm">
              Open full record, targets and notes →
            </Link>
          </div>
        </div>
      )}
      {open && absent && <p className="rec-line muted">Marked absent for week {week}. Every line is recorded as Absent.</p>}
    </div>
  )
}

function LineRow({
  sv,
  line,
  cell,
  week,
  run,
}: {
  sv: StudentView
  line: Line
  cell: WeekCell
  week: number
  run: (fn: () => Promise<void>) => Promise<void>
}) {
  const { saveResult, saveTargets, view } = useTerm()
  const [part, setPart] = useState(cell.kind === 'part' ? cell.result?.value ?? '' : '')
  const value = cell.result?.value ?? ''

  if (cell.cancelled) return null

  if (!line.has_done) {
    return (
      <div className="rec-line">
        <span className="rec-line__label">{line.label}</span>
        <span>{line.type === 'juz' ? (sv.juz.get(week) ? `Juz ${sv.juz.get(week)}` : '—') : cell.target ?? '—'}</span>
      </div>
    )
  }

  const set = (v: string) => run(() => saveResult(line.id, week, value === v ? '' : v))
  const selfChecked = sv.selfChecked.has(selfCheckKey(line.id, week))
  const passedJuz = cell.isTest && cell.kind === 'pass' ? testJuz(cell.target) : null
  const juzLine = sv.lines.find((l) => l.type === 'juz')
  const nextWeek = view?.payload.weeks.find((w) => w.week_number === week + 1)

  return (
    <div className="rec-line">
      <div>
        <span className="rec-line__label">{line.label}</span>{' '}
        {cell.target ? (
          <span className={`rec-line__target ${colourClass(cell.targetColour)}`}>
            {isRevisionLine(line) && !cell.overridden ? 'Revise: ' : ''}
            {cell.target}
          </span>
        ) : (
          <span className="muted">no target</span>
        )}
        {cell.carried && cell.plan && cell.plan !== cell.target && <div className="rec-line__plan">Plan: {cell.plan}</div>}
        {selfChecked && <div className="rec-selfcheck">✓ Student says they revised with their partner</div>}
      </div>
      <div className="rec-buttons">
        {cell.isTest ? (
          <>
            <ResultButton label="Pass" on={value === 'Pass'} colour="test-pass" onClick={() => set('Pass')} />
            <ResultButton label="Fail" on={value === 'Fail'} colour="test-fail" onClick={() => set('Fail')} />
            <ResultButton label="Redo" on={value === 'Redo'} colour="test-fail" onClick={() => set('Redo')} />
          </>
        ) : (
          <>
            <ResultButton label="Y" on={value === 'Y'} colour="green" onClick={() => set('Y')} />
            <ResultButton label="N" on={value === 'N'} colour="red" onClick={() => set('N')} />
            <ResultButton label="Absent" on={/^absent$/i.test(value)} colour="red" onClick={() => set('Absent')} />
            <input
              className="rec-part"
              type="number"
              inputMode="decimal"
              step={0.25}
              min={0}
              placeholder="Part"
              aria-label={`${line.label} part done`}
              value={part}
              onChange={(e) => setPart(e.target.value)}
              onBlur={() => {
                if (part !== (cell.kind === 'part' ? value : '')) void run(() => saveResult(line.id, week, part))
              }}
            />
          </>
        )}
        {cell.result?.initials && <span className="muted">{cell.result.initials}</span>}
      </div>
      {passedJuz && juzLine && nextWeek && passedJuz > 1 && (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => run(() => saveTargets(juzLine.id, 'plan', [{ week: week + 1, text: `Juz ${passedJuz - 1}` }]))}
        >
          Passed: set Juz {passedJuz - 1} from week {week + 1}
        </button>
      )}
    </div>
  )
}

function ResultButton({ label, on, colour, onClick }: { label: string; on: boolean; colour: string; onClick: () => void }) {
  return (
    <button type="button" className={`rec-btn ${on ? `is-on c-${colour}` : ''}`} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  )
}
