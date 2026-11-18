import { useState } from 'react'
import { formatUKDate } from '../lib/dates'
import { doneRowLabel, type StudentView } from './model'
import { isRevisionLine, revisionPortionOptions, type CellColour, type Week, type WeekCell } from './rules'
import { usePendingWrites } from './sync'

export function colourClass(c: CellColour): string {
  return `c-${c}`
}

/** What goes in a done box: "Y MMA", "1.5 AB", "Pass AB", "Absent". */
export function doneText(cell: WeekCell): string {
  if (!cell.result) return cell.kind === 'absent' ? 'Absent' : ''
  return [cell.result.value, cell.result.initials].filter(Boolean).join(' ')
}

export function StatusText({ status }: { status: 'On track' | 'Behind' | null }) {
  if (!status) return <span className="muted">—</span>
  return <span className={status === 'Behind' ? 'ov-status-behind' : 'ov-status-ontrack'}>{status}</span>
}

export function AttendanceText({ pct, low }: { pct: number | null; low: boolean }) {
  if (pct === null) return <span className="muted">—</span>
  return <span className={low ? 'ov-att-low' : ''}>{pct}%</span>
}

export function SyncBadge() {
  const { pending, error } = usePendingWrites()
  if (error) return <span className="hf-sync" title={error}>⚠ {error}</span>
  if (pending === 0) return null
  return (
    <span className="hf-sync" role="status">
      {pending} waiting to sync
    </span>
  )
}

export function ColourLegend() {
  return (
    <div className="legend" aria-label="Colour key">
      <span className="c-green">Y done</span>
      <span className="c-amber">Part done / carried</span>
      <span className="c-red">N / Absent</span>
      <span className="c-test-due">Test due</span>
      <span className="c-test-pass">Test passed</span>
      <span className="c-test-fail">Test failed / redo</span>
      <span className="c-gold">Revise this week</span>
    </div>
  )
}

/** Free-text target input with the revision portion drop-down (datalist). */
export function TargetInput({
  value,
  revision,
  onCommit,
  placeholder,
  className = 'target-input',
  ariaLabel,
}: {
  value: string
  revision: boolean
  onCommit: (text: string) => void
  placeholder?: string
  className?: string
  ariaLabel: string
}) {
  const [text, setText] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value)
  }
  return (
    <input
      className={className}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      list={revision ? 'revision-portions' : undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== value.trim()) onCommit(text)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

/** Render once per page: the revision portion options for every TargetInput. */
export function RevisionPortionList() {
  return (
    <datalist id="revision-portions">
      {revisionPortionOptions().map((o) => (
        <option key={o} value={o} />
      ))}
    </datalist>
  )
}

/**
 * The 10-week student sheet (S3): label, Juz, Target, Done and teacher initials
 * for every line. With `editable`, targets can be typed in place (T3).
 */
export function StudentSheet({
  sv,
  weeks,
  currentWeek,
  editable,
  onPlan,
  onOverride,
}: {
  sv: StudentView
  weeks: Week[]
  currentWeek: number
  editable?: boolean
  onPlan?: (lineId: string, week: number, text: string) => void
  onOverride?: (lineId: string, week: number, text: string | null) => void
}) {
  return (
    <div className="hf-grid-wrap">
      <table className="hf-grid">
        <thead>
          <tr>
            <th className="row-label">Week</th>
            {weeks.map((w) => (
              <th key={w.week_number} data-current={w.week_number === currentWeek}>
                {w.week_number}
                <small>{formatUKDate(w.class_date)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr className="student-row">
            <td className="row-label">Juz</td>
            {weeks.map((w) => (
              <td key={w.week_number} className={w.cancelled ? 'cancelled' : ''}>
                {w.cancelled ? 'No class' : sv.juz.get(w.week_number) ?? ''}
              </td>
            ))}
          </tr>
          {sv.lines.map((line) => {
            const cells = sv.cells.get(line.id) ?? []
            const revision = isRevisionLine(line)
            return [
              <tr key={line.id}>
                <td className="row-label">{line.label}</td>
                {cells.map((c) => (
                  <td
                    key={c.week}
                    data-current={c.week === currentWeek}
                    className={c.cancelled ? 'cancelled' : colourClass(c.targetColour)}
                  >
                    {c.cancelled ? (
                      'No class'
                    ) : editable && onPlan ? (
                      <TargetInput
                        value={c.plan ?? ''}
                        revision={revision}
                        ariaLabel={`${line.label} plan, week ${c.week}`}
                        onCommit={(t) => onPlan(line.id, c.week, t)}
                      />
                    ) : (
                      <>
                        {c.target ?? ''}
                        {c.carried && c.plan && c.plan !== c.target && <span className="plan-note">Plan: {c.plan}</span>}
                      </>
                    )}
                  </td>
                ))}
              </tr>,
              revision && editable && onOverride ? (
                <tr key={`${line.id}-revise`}>
                  <td className="row-label" style={{ fontWeight: 400 }}>
                    Revise this week
                  </td>
                  {cells.map((c) => (
                    <td key={c.week} className={c.cancelled ? 'cancelled' : c.overridden ? '' : 'c-gold'}>
                      {!c.cancelled && (
                        <>
                          <TargetInput
                            value={c.overridden ? c.target ?? '' : ''}
                            placeholder={c.suggestion ?? ''}
                            revision
                            ariaLabel={`Revise this week, week ${c.week}`}
                            onCommit={(t) => onOverride(line.id, c.week, t.trim() || null)}
                          />
                          {c.overridden && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ padding: '0 4px', fontSize: '0.65rem' }}
                              onClick={() => onOverride(line.id, c.week, null)}
                              title="Reset to suggestion"
                            >
                              Reset
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ) : revision && !editable ? (
                <tr key={`${line.id}-revise`}>
                  <td className="row-label" style={{ fontWeight: 400 }}>
                    Revise this week
                  </td>
                  {cells.map((c) => (
                    <td key={c.week} className={c.cancelled ? 'cancelled' : c.overridden ? '' : 'c-gold'}>
                      {c.cancelled ? '' : c.target ?? ''}
                    </td>
                  ))}
                </tr>
              ) : null,
              line.has_done ? (
                <tr key={`${line.id}-done`} className="done-row">
                  <td className="row-label">{doneRowLabel(line)}</td>
                  {cells.map((c) => (
                    <td key={c.week} data-current={c.week === currentWeek} className={c.cancelled ? 'cancelled' : colourClass(c.colour)}>
                      {!c.cancelled && (
                        <>
                          {c.result?.value ?? (c.kind === 'absent' ? 'Absent' : '')}
                          {c.result?.initials && <span className="initials">{c.result.initials}</span>}
                          {c.result?.note && <span className="plan-note">{c.result.note}</span>}
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ) : null,
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}

export function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text)
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return Promise.resolve()
}

/** Absolute link a student opens to see their record. */
export function studentLink(token: string): string {
  const base = window.location.href.split('#')[0]
  return `${base}#/s/${token}`
}
