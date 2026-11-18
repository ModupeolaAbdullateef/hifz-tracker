import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import SiteHeader from '../../components/SiteHeader'
import { ErrorBanner, LoadingState } from '../../components/LoadingAndEmpty'
import { formatUKDate, todayLondonISO } from '../../lib/dates'
import { studentOpen, studentSelfCheck } from '../../hifdh/api'
import { AttendanceText, colourClass, ColourLegend, RevisionPortionList, StatusText, StudentSheet } from '../../hifdh/components'
import { buildTermView, selfCheckKey, type StudentView } from '../../hifdh/model'
import { currentWeekNumber, isRevisionLine, type Week } from '../../hifdh/rules'
import type { StudentOpenPayload } from '../../hifdh/types'

const pinKey = (link: string) => `hifdh_pin_${link}`

function readPin(link: string): string {
  try {
    return localStorage.getItem(pinKey(link)) ?? ''
  } catch {
    return ''
  }
}

/** S1: a student opens their own record from their personal link and PIN. */
export default function StudentRecord() {
  const { link = '' } = useParams<{ link: string }>()
  const [pin, setPin] = useState(() => readPin(link))
  const [remember, setRemember] = useState(true)
  const [data, setData] = useState<StudentOpenPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const open = useCallback(
    async (p: string, save: boolean) => {
      setBusy(true)
      setError(null)
      try {
        const res = await studentOpen(link, p.trim())
        setData(res)
        try {
          if (save) localStorage.setItem(pinKey(link), p.trim())
          else localStorage.removeItem(pinKey(link))
        } catch {
          // storage unavailable: just don't remember
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not open your record.')
        try {
          localStorage.removeItem(pinKey(link))
        } catch {
          // ignore
        }
      } finally {
        setBusy(false)
      }
    },
    [link],
  )

  useEffect(() => {
    const saved = readPin(link)
    if (saved) void open(saved, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link])

  if (!data) {
    return (
      <div className="app-shell">
        <SiteHeader />
        <main className="page page--narrow">
          <div className="card">
            <h2 className="mt-0">My Hifdh record</h2>
            {busy && !error ? (
              <LoadingState text="Opening your record…" />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  void open(pin, remember)
                }}
              >
                <div className="field">
                  <label htmlFor="pin">Your 4-digit PIN</label>
                  <input
                    id="pin"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    required
                    style={{ fontSize: '1.5rem', letterSpacing: 8, textAlign: 'center' }}
                  />
                  <p className="field-hint">Your teacher sent you this with your link. Ask them if you've lost it.</p>
                </div>
                <label className="tick-box" style={{ marginBottom: 12 }}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>Remember on this phone</span>
                </label>
                {error && <ErrorBanner text={error} />}
                <button type="submit" className="btn btn-primary btn-block" disabled={busy || pin.length < 4}>
                  {busy ? 'Opening…' : 'Open my record'}
                </button>
              </form>
            )}
          </div>
        </main>
      </div>
    )
  }

  return <RecordView data={data} link={link} pin={pin || readPin(link)} onReload={() => open(pin || readPin(link), true)} onExit={() => {
    try {
      localStorage.removeItem(pinKey(link))
    } catch {
      // ignore
    }
    setData(null)
    setPin('')
  }} />
}

function RecordView({
  data,
  link,
  pin,
  onReload,
  onExit,
}: {
  data: StudentOpenPayload
  link: string
  pin: string
  onReload: () => Promise<void>
  onExit: () => void
}) {
  const today = todayLondonISO()
  const views = useMemo(() => data.terms.map((t) => ({ payload: t, sv: buildTermView(t, today).students[0] })).filter((v) => v.sv), [data, today])
  const [termIdx, setTermIdx] = useState(0)
  const current = views[termIdx]

  if (!current) {
    return (
      <div className="app-shell">
        <SiteHeader />
        <main className="page page--narrow">
          <div className="card">
            <h2 className="mt-0">Assalamu alaikum {data.student.display_name}</h2>
            <p>You haven't been added to a term yet. Your record will appear here once your teacher sets it up.</p>
          </div>
        </main>
      </div>
    )
  }

  const { sv, payload } = current
  const weeks = payload.weeks
  const nowWeek = currentWeekNumber(weeks, today)
  // Before class: show the coming class's targets; after it: the next one.
  const focus = weeks.find((w) => w.class_date >= today && !w.cancelled) ?? weeks.find((w) => w.week_number === nowWeek) ?? weeks[0]

  return (
    <div className="app-shell">
      <SiteHeader />
      <main className="page">
        <div className="st-hero">
          <div className="flex-between flex-wrap gap-2">
            <div>
              <h2>{data.student.display_name}</h2>
              <p>
                {data.student.group} · {payload.term.name}
                {sv.juz.get(focus.week_number) ? ` · Juz ${sv.juz.get(focus.week_number)}` : ''}
              </p>
            </div>
            <button className="btn btn-hero-ghost btn-sm" onClick={onExit}>
              Log out
            </button>
          </div>
        </div>

        {views.length > 1 && (
          <div className="field">
            <label htmlFor="st-term">Term</label>
            <select id="st-term" value={termIdx} onChange={(e) => setTermIdx(Number(e.target.value))}>
              {views.map((v, i) => (
                <option key={v.payload.term.id} value={i}>
                  {v.payload.term.name}
                  {i === 0 ? ' (current)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {termIdx === 0 && focus && <ThisWeekCard sv={sv} week={focus} link={link} pin={pin} onChanged={onReload} />}

        <div className="card">
          <h3 className="mt-0">Revision partner</h3>
          {sv.partners.length === 0 ? (
            <p className="muted">Not paired yet.</p>
          ) : (
            <p style={{ fontSize: '1.1rem' }}>
              {sv.partners.length === 1 ? 'Revision partner: ' : 'Revision partners: '}
              <strong>{sv.partners.join(' & ')}</strong>
            </p>
          )}
        </div>

        <div className="st-stats">
          <div className="st-stat">
            <span className="st-stat__value">{sv.totals.totalMemorised}</span>
            <span className="st-stat__label">Total memorised (pages)</span>
          </div>
          <div className="st-stat">
            <span className="st-stat__value">{sv.totals.expectedByNow}</span>
            <span className="st-stat__label">Expected by now</span>
          </div>
          <div className="st-stat">
            <span className="st-stat__value">
              <StatusText status={sv.totals.status} />
            </span>
            <span className="st-stat__label">Status</span>
          </div>
          <div className="st-stat">
            <span className="st-stat__value">
              <AttendanceText pct={sv.totals.attendancePct} low={sv.totals.attendanceLow} />
            </span>
            <span className="st-stat__label">Attendance</span>
          </div>
        </div>

        <div className="card">
          <h3 className="mt-0">My 10 weeks</h3>
          <StudentSheet sv={sv} weeks={weeks} currentWeek={nowWeek} />
          <ColourLegend />
        </div>

        {sv.notes.length > 0 && (
          <div className="card">
            <h3 className="mt-0">Notes from your teacher</h3>
            {sv.notes.map((n) => (
              <div key={n.id} className="note">
                <div className="note__head">
                  <strong>{n.author}</strong>
                  <span className="muted">{new Date(n.created_at).toLocaleDateString('en-GB')}</span>
                </div>
                <p className="note__text">{n.text}</p>
              </div>
            ))}
          </div>
        )}

        {views.length > 1 && <TermsChart views={views.map((v) => ({ name: v.payload.term.name, total: v.sv.totals.totalMemorised }))} />}
      </main>
      <RevisionPortionList />
    </div>
  )
}

/** S2 (and S7): this week's targets first, with carried targets highlighted. */
function ThisWeekCard({
  sv,
  week,
  link,
  pin,
  onChanged,
}: {
  sv: StudentView
  week: Week
  link: string
  pin: string
  onChanged: () => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const items = sv.lines
    .filter((l) => l.type !== 'juz')
    .map((line) => ({ line, cell: sv.cells.get(line.id)?.find((c) => c.week === week.week_number) }))
    .filter((x) => x.cell && x.cell.target && !x.cell.cancelled)

  return (
    <div className="card">
      <h3 className="mt-0">
        This week · week {week.week_number}, {formatUKDate(week.class_date)}
      </h3>
      <div className="st-week">
        {sv.juz.get(week.week_number) && (
          <div className="st-week__item">
            <span className="st-week__label">Current juz</span>
            <strong>Juz {sv.juz.get(week.week_number)}</strong>
          </div>
        )}
        {items.length === 0 && <p className="muted">No targets set for this week yet.</p>}
        {items.map(({ line, cell }) => {
          const c = cell!
          const revision = isRevisionLine(line)
          const checked = sv.selfChecked.has(selfCheckKey(line.id, week.week_number))
          return (
            <div key={line.id} className={`st-week__item ${c.carried || c.isTest ? colourClass(c.targetColour) : ''}`}>
              <div>
                <span className="st-week__label">{c.isTest ? 'Juz test due' : revision ? `${line.label}: revise` : line.label}</span>
                {c.carried && c.plan && c.plan !== c.target && <div className="plan-note">Plan: {c.plan}</div>}
                {revision && line.has_done && !c.result && (
                  <label className="tick-box" style={{ marginTop: 6, minHeight: 36 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={async (e) => {
                        setError(null)
                        try {
                          await studentSelfCheck(link, pin, line.id, week.week_number, e.target.checked)
                          await onChanged()
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Could not save.')
                        }
                      }}
                    />
                    <span>I revised this with my partner</span>
                  </label>
                )}
              </div>
              <strong>{c.target}</strong>
            </div>
          )
        })}
      </div>
      <p className="field-hint">Ticking “I revised” lets your teacher know. Your teacher still marks it in class.</p>
      {error && <ErrorBanner text={error} />}
    </div>
  )
}

/** Stage 3: progress across terms. */
function TermsChart({ views }: { views: { name: string; total: number }[] }) {
  const data = [...views].reverse()
  const max = Math.max(1, ...data.map((d) => d.total))
  const barW = 48
  const gap = 24
  const h = 160
  const w = data.length * (barW + gap) + gap
  return (
    <div className="card">
      <h3 className="mt-0">How far I've come</h3>
      <div style={{ overflowX: 'auto' }}>
        <svg width={w} height={h + 40} role="img" aria-label="Total pages memorised at each term">
          {data.map((d, i) => {
            const bh = (d.total / max) * h
            const x = gap + i * (barW + gap)
            return (
              <g key={d.name}>
                <rect x={x} y={h - bh + 10} width={barW} height={bh} rx={4} fill="var(--brand-primary)" />
                <text x={x + barW / 2} y={h - bh + 4} textAnchor="middle" fontSize="12" fill="var(--brand-ink)">
                  {d.total}
                </text>
                <text x={x + barW / 2} y={h + 28} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                  {d.name.length > 12 ? `${d.name.slice(0, 11)}…` : d.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <p className="field-hint">Total pages memorised in each term.</p>
    </div>
  )
}
