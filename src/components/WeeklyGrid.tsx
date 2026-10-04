import { useEffect, useRef } from 'react'
import { formatUKDate, isFutureWeek } from '../lib/dates'
import type { CourseWeek, RecordField, WeeklyRecord } from '../lib/types'

type ColumnState = 'cancelled' | 'not-joined' | 'future' | 'absent' | 'good' | 'recorded' | 'pending'

interface WeeklyGridProps {
  fields: RecordField[]
  weeks: CourseWeek[]
  records: WeeklyRecord[]
  joinWeek: number
  currentWeek: number
  onWeekClick?: (weekNumber: number) => void
}

function columnState(week: CourseWeek, record: WeeklyRecord | undefined, joinWeek: number): ColumnState {
  if (week.cancelled) return 'cancelled'
  if (week.week_number < joinWeek) return 'not-joined'
  if (!record) {
    return isFutureWeek(week) ? 'future' : 'pending'
  }
  if (record.status === 'absent') return 'absent'
  if (record.good_week) return 'good'
  return 'recorded'
}

function formatValue(field: RecordField, record: WeeklyRecord | undefined): string {
  if (!record || record.status === 'absent') return '—'
  const raw = record.values?.[field.key]
  if (field.type === 'yesno') {
    if (raw === true) return 'Yes'
    if (raw === false) return 'No'
    return '—'
  }
  if (typeof raw === 'number') {
    return field.unit ? `${raw} ${field.unit}` : String(raw)
  }
  return '—'
}

export default function WeeklyGrid({ fields, weeks, records, joinWeek, currentWeek, onWeekClick }: WeeklyGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentColRef = useRef<HTMLTableCellElement>(null)

  useEffect(() => {
    if (scrollRef.current && currentColRef.current) {
      const container = scrollRef.current
      const col = currentColRef.current
      container.scrollLeft = col.offsetLeft - container.clientWidth / 2 + col.clientWidth / 2
    }
  }, [currentWeek])

  const recordByWeek = new Map(records.map((r) => [r.week_number, r]))

  return (
    <div className="grid-scroll" ref={scrollRef}>
      <table className="hifz-grid">
        <thead>
          <tr>
            <th className="row-label">Field / Maes</th>
            {weeks.map((week) => {
              const isCurrent = week.week_number === currentWeek
              const record = recordByWeek.get(week.week_number)
              const state = columnState(week, record, joinWeek)
              return (
                <th
                  key={week.week_number}
                  data-current={isCurrent}
                  ref={isCurrent ? currentColRef : undefined}
                >
                  {onWeekClick ? (
                    <button type="button" className="col-head" onClick={() => onWeekClick(week.week_number)}>
                      W{week.week_number}
                    </button>
                  ) : (
                    <>W{week.week_number}</>
                  )}
                  <small>{formatUKDate(week.class_date)}</small>
                  {state === 'absent' && <span className="cell-tag cell-tag--absent">Absent</span>}
                  {state === 'good' && <span className="cell-tag cell-tag--good">Good week</span>}
                  {state === 'cancelled' && <span className="cell-tag muted">No class</span>}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {fields.map((field) => (
            <tr key={field.key}>
              <td className="row-label">{field.label}</td>
              {weeks.map((week) => {
                const record = recordByWeek.get(week.week_number)
                const state = columnState(week, record, joinWeek)
                const isCurrent = week.week_number === currentWeek
                return (
                  <td key={week.week_number} data-state={state} data-current={isCurrent}>
                    {state === 'cancelled' && 'No class'}
                    {state === 'not-joined' && 'Not joined'}
                    {state === 'future' && '—'}
                    {state === 'pending' && '—'}
                    {(state === 'absent' || state === 'good' || state === 'recorded') &&
                      formatValue(field, record)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
