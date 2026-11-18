import { useEffect, useMemo, useState } from 'react'
import { EmptyState, SuccessBanner } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'
import { formatUKDate } from '../../lib/dates'
import { getAdminStudents } from '../../hifdh/api'
import { copyText, studentLink } from '../../hifdh/components'
import type { StudentView } from '../../hifdh/model'
import { currentWeekNumber, isRevisionLine, type Week } from '../../hifdh/rules'
import { useTerm } from '../../hifdh/TermContext'

/** The targets a student should prepare for a week, as short lines of text. */
export function weekTargets(sv: StudentView, week: number): string[] {
  const out: string[] = []
  const juz = sv.juz.get(week)
  if (juz) out.push(`Juz ${juz}`)
  for (const line of sv.lines) {
    if (line.type === 'juz') continue
    const c = sv.cells.get(line.id)?.find((x) => x.week === week)
    if (!c || c.cancelled || !c.target) continue
    const label = isRevisionLine(line) ? `${line.label} (revise)` : line.label
    out.push(`${label}: ${c.target}${c.carried && c.plan && c.plan !== c.target ? ` (carried; plan was ${c.plan})` : ''}`)
  }
  return out
}

function message(sv: StudentView, week: Week, link: string | null): string {
  const lines = weekTargets(sv, week.week_number)
  return [
    `Assalamu alaikum ${sv.student.display_name}.`,
    `Hifdh class, week ${week.week_number} (${formatUKDate(week.class_date)}):`,
    ...lines.map((l) => `• ${l}`),
    sv.partners.length ? `Revision partner${sv.partners.length > 1 ? 's' : ''}: ${sv.partners.join(' & ')}` : '',
    link ? `Your record: ${link}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Stage 3: reminders of this week's targets, sent from the teacher's own phone. */
export default function Reminders() {
  const { session, isAdmin } = useAuth()
  const { view, term, today, group } = useTerm()
  const weeks = view?.payload.weeks ?? []
  const [week, setWeek] = useState<number | null>(null)
  const [links, setLinks] = useState<Map<string, string>>(new Map())
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!weeks.length || week !== null) return
    // Default to the next class that hasn't happened yet.
    const upcoming = weeks.find((w) => w.class_date >= today && !w.cancelled)
    setWeek(upcoming?.week_number ?? currentWeekNumber(weeks, today))
  }, [weeks, week, today])

  useEffect(() => {
    if (!isAdmin || !session || !group) return
    getAdminStudents(session.token, group.id)
      .then((rows) => setLinks(new Map(rows.map((r) => [r.id, studentLink(r.link_token)]))))
      .catch(() => setLinks(new Map()))
  }, [isAdmin, session, group])

  const wk = weeks.find((w) => w.week_number === week)
  const active = useMemo(() => (view?.students ?? []).filter((s) => s.student.status === 'active'), [view])

  if (!term || !view || !wk) return <EmptyState text="No term selected." />

  return (
    <div>
      <div className="flex-between flex-wrap gap-2">
        <h2 className="mt-0">Reminders</h2>
        <select aria-label="Week" value={week ?? ''} onChange={(e) => setWeek(Number(e.target.value))}>
          {weeks.map((w) => (
            <option key={w.week_number} value={w.week_number}>
              Week {w.week_number} · {formatUKDate(w.class_date)}
            </option>
          ))}
        </select>
      </div>
      <p className="muted">
        Each student's targets for the week, ready to send on WhatsApp or copy.{' '}
        {isAdmin ? 'Messages include their personal link.' : 'Students open their record with their own link and PIN.'}
      </p>
      {copied && <SuccessBanner text={copied} />}
      {active.map((sv) => {
        const text = message(sv, wk, links.get(sv.student.id) ?? null)
        return (
          <div className="card" key={sv.student.id}>
            <div className="flex-between flex-wrap gap-2">
              <strong>{sv.student.display_name}</strong>
              <div className="flex gap-2">
                <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={async () => {
                    await copyText(text)
                    setCopied(`Copied ${sv.student.display_name}'s reminder.`)
                  }}
                >
                  Copy
                </button>
              </div>
            </div>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '8px 0 0' }}>{text}</pre>
          </div>
        )
      })}
    </div>
  )
}
