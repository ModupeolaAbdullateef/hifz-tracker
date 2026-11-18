import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorBanner, SuccessBanner } from '../../components/LoadingAndEmpty'
import { useAuth } from '../../context/AuthContext'
import {
  addNote,
  deleteLine,
  deleteNote,
  getStudentHistory,
  reorderLines,
  setEnrolment,
  setNoteVisibility,
  upsertLine,
} from '../../hifdh/api'
import { AttendanceText, ColourLegend, StatusText, StudentSheet, TargetInput } from '../../hifdh/components'
import { buildTermView, type StudentView } from '../../hifdh/model'
import { currentWeekNumber, isRevisionLine, LINE_TYPE_LABELS, type LineType } from '../../hifdh/rules'
import { useTerm } from '../../hifdh/TermContext'
import type { TermPayload } from '../../hifdh/types'

export default function StudentPage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { session, isAdmin } = useAuth()
  const { view, today, saveTargets, reloadTerm, term } = useTerm()
  const [error, setError] = useState<string | null>(null)
  const sv = studentId ? view?.byId.get(studentId) : undefined

  if (!view || !term) return <EmptyState text="No term selected." />
  if (!sv) return <EmptyState text="This student is not in the selected term. Pick another term at the top." />

  const weeks = view.payload.weeks
  const current = currentWeekNumber(weeks, today)

  async function run(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    }
  }

  return (
    <div>
      <p className="no-print">
        <Link to="/staff/overview">← Overview</Link>
      </p>
      <div className="flex-between flex-wrap gap-2">
        <div>
          <h2 className="mt-0" style={{ marginBottom: 4 }}>
            <span className={sv.student.is_teacher ? 'teacher-name' : ''}>{sv.student.display_name}</span>{' '}
            {sv.student.status === 'left' && <span className="chip chip--left">left</span>}
          </h2>
          <p className="muted mt-0">
            {sv.student.code}
            {sv.partners.length > 0 && ` · Revision partner${sv.partners.length > 1 ? 's' : ''}: ${sv.partners.join(' & ')}`}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>

      <Stats sv={sv} />
      {error && <ErrorBanner text={error} />}

      <div className="card">
        <h3 className="mt-0">10-week record</h3>
        <p className="field-hint no-print">
          Type each week's plan in the line rows. On revision lines the gold “Revise this week” row shows the carry-over
          suggestion; type over it to set your own, or tap Reset to go back to the suggestion.
        </p>
        <StudentSheet
          sv={sv}
          weeks={weeks}
          currentWeek={current}
          editable
          onPlan={(lineId, week, text) => run(() => saveTargets(lineId, 'plan', [{ week, text }]))}
          onOverride={(lineId, week, text) => run(() => saveTargets(lineId, 'override', [{ week, text }]))}
        />
        <ColourLegend />
      </div>

      <FillLine sv={sv} weeks={weeks.map((w) => w.week_number)} run={run} />
      <Notes sv={sv} run={run} />
      {isAdmin && session && <EnrolmentSettings key={sv.student.id} sv={sv} termId={term.id} run={run} onSaved={reloadTerm} />}
      {isAdmin && session && <LinesEditor sv={sv} termId={term.id} run={run} onSaved={reloadTerm} />}
      <History studentId={sv.student.id} currentTermId={term.id} />
    </div>
  )
}

function Stats({ sv }: { sv: StudentView }) {
  const t = sv.totals
  return (
    <div className="st-stats">
      <div className="st-stat">
        <span className="st-stat__value">{t.totalMemorised}</span>
        <span className="st-stat__label">Total memorised</span>
      </div>
      <div className="st-stat">
        <span className="st-stat__value">{t.expectedByNow}</span>
        <span className="st-stat__label">Expected by now</span>
      </div>
      <div className="st-stat">
        <span className="st-stat__value">{t.totalProjected}</span>
        <span className="st-stat__label">Total projected</span>
      </div>
      <div className="st-stat">
        <span className="st-stat__value">
          <StatusText status={t.status} />
        </span>
        <span className="st-stat__label">Status</span>
      </div>
      <div className="st-stat">
        <span className="st-stat__value">
          <AttendanceText pct={t.attendancePct} low={t.attendanceLow} />
        </span>
        <span className="st-stat__label">
          Attendance · {t.weeksAbsent} week{t.weeksAbsent === 1 ? '' : 's'} absent
        </span>
      </div>
    </div>
  )
}

/** T3: fill a whole line at once, e.g. "2.5" every week. */
function FillLine({ sv, weeks, run }: { sv: StudentView; weeks: number[]; run: (fn: () => Promise<void>) => Promise<void> }) {
  const { saveTargets } = useTerm()
  const lines = sv.lines.filter((l) => l.type !== 'juz')
  const [lineId, setLineId] = useState(lines[0]?.id ?? '')
  const [text, setText] = useState('')
  const [from, setFrom] = useState(1)
  const line = lines.find((l) => l.id === lineId)
  if (lines.length === 0) return null
  return (
    <div className="card no-print">
      <h3 className="mt-0">Fill a whole line</h3>
      <div className="flex gap-2 flex-wrap" style={{ alignItems: 'end' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="fill-line">Line</label>
          <select id="fill-line" value={lineId} onChange={(e) => setLineId(e.target.value)}>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="fill-text">Target every week</label>
          <TargetInput
            className=""
            value={text}
            revision={!!line && isRevisionLine(line)}
            ariaLabel="Target every week"
            placeholder="e.g. 2.5"
            onCommit={setText}
          />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="fill-from">From week</label>
          <select id="fill-from" value={from} onChange={(e) => setFrom(Number(e.target.value))}>
            {weeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-primary"
          disabled={!lineId || !text.trim()}
          onClick={() =>
            run(() => saveTargets(lineId, 'plan', weeks.filter((w) => w >= from).map((week) => ({ week, text: text.trim() }))))
          }
        >
          Fill
        </button>
      </div>
    </div>
  )
}

function Notes({ sv, run }: { sv: StudentView; run: (fn: () => Promise<void>) => Promise<void> }) {
  const { session, isAdmin } = useAuth()
  const { reloadTerm } = useTerm()
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(false)
  if (!session) return null
  return (
    <div className="card">
      <h3 className="mt-0">Notes</h3>
      {sv.notes.length === 0 && <p className="muted">No notes yet.</p>}
      <ul className="note-list" style={{ listStyle: 'none', padding: 0 }}>
        {sv.notes.map((n) => (
          <li key={n.id} className="note">
            <div className="note__head">
              <strong>{n.author}</strong>
              <span className="muted">{new Date(n.created_at).toLocaleDateString('en-GB')}</span>
              <span className="chip">{n.visible_to_student ? 'Student can see' : 'Teachers only'}</span>
            </div>
            <p className="note__text">{n.text}</p>
            <div className="flex gap-2 no-print">
              {isAdmin && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    run(async () => {
                      await setNoteVisibility(session.token, n.id, !n.visible_to_student)
                      await reloadTerm()
                    })
                  }
                >
                  {n.visible_to_student ? 'Hide from student' : 'Show to student'}
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  run(async () => {
                    await deleteNote(session.token, n.id)
                    await reloadTerm()
                  })
                }
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      <form
        className="no-print"
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await addNote(session.token, sv.student.id, text, visible)
            setText('')
            setVisible(false)
            await reloadTerm()
          })
        }}
      >
        <div className="field">
          <label htmlFor="note-text">Add a dated note</label>
          <textarea id="note-text" value={text} onChange={(e) => setText(e.target.value)} required />
        </div>
        {isAdmin && (
          <label className="tick-box" style={{ marginBottom: 8 }}>
            <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
            <span>Student can see this note</span>
          </label>
        )}
        {!isAdmin && <p className="field-hint">Notes are for teachers only unless the admin shares them with the student.</p>}
        <div>
          <button type="submit" className="btn btn-primary btn-sm">
            Add note
          </button>
        </div>
      </form>
    </div>
  )
}

function EnrolmentSettings({
  sv,
  termId,
  run,
  onSaved,
}: {
  sv: StudentView
  termId: number
  run: (fn: () => Promise<void>) => Promise<void>
  onSaved: () => Promise<void>
}) {
  const { session } = useAuth()
  const s = sv.student
  const [pagesBefore, setPagesBefore] = useState(String(s.pages_before ?? 0))
  const [override, setOverride] = useState(s.projected_override === null ? '' : String(s.projected_override))
  const [paid, setPaid] = useState(s.paid)
  const [exFrom, setExFrom] = useState(s.exception_from ?? '')
  const [exUntil, setExUntil] = useState(s.exception_until ?? '')
  const [msg, setMsg] = useState<string | null>(null)
  if (!session) return null
  return (
    <div className="card no-print">
      <h3 className="mt-0">This term (admin)</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await setEnrolment(session.token, {
              termId,
              studentId: s.id,
              pagesBefore: Number(pagesBefore) || 0,
              projectedOverride: override === '' ? null : Number(override),
              paid,
              exceptionFrom: exFrom || null,
              exceptionUntil: exUntil || null,
            })
            await onSaved()
            setMsg('Saved.')
          })
        }}
      >
        <div className="flex gap-3 flex-wrap">
          <div className="field">
            <label htmlFor="pb">Pages memorised before term</label>
            <input id="pb" type="number" step={0.5} value={pagesBefore} onChange={(e) => setPagesBefore(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="po">Total projected (override)</label>
            <input id="po" type="number" step={0.5} value={override} placeholder="Worked out" onChange={(e) => setOverride(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ef">Excused absence from</label>
            <input id="ef" type="date" value={exFrom} onChange={(e) => setExFrom(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="eu">until</label>
            <input id="eu" type="date" value={exUntil} onChange={(e) => setExUntil(e.target.value)} />
          </div>
        </div>
        <p className="field-hint">During an excused period (e.g. on holiday), Absent shows green and doesn't count against attendance.</p>
        <label className="tick-box" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
          <span>Paid this term</span>
        </label>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <button type="submit" className="btn btn-primary btn-sm">
            Save
          </button>
          {msg && <SuccessBanner text={msg} />}
        </div>
      </form>
    </div>
  )
}

const LINE_TYPES = Object.keys(LINE_TYPE_LABELS) as LineType[]

interface LineDraft {
  id: string | null
  label: string
  type: LineType
  has_done: boolean
  done_label: string
}

const EMPTY_LINE: LineDraft = { id: null, label: '', type: 'custom', has_done: true, done_label: '' }

function LinesEditor({
  sv,
  termId,
  run,
  onSaved,
}: {
  sv: StudentView
  termId: number
  run: (fn: () => Promise<void>) => Promise<void>
  onSaved: () => Promise<void>
}) {
  const { session } = useAuth()
  const [editing, setEditing] = useState<LineDraft>(EMPTY_LINE)
  if (!session) return null

  async function move(idx: number, dir: -1 | 1) {
    const ids = sv.lines.map((l) => l.id)
    const j = idx + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    await reorderLines(session!.token, ids)
    await onSaved()
  }

  return (
    <div className="card no-print">
      <h3 className="mt-0">Lines (admin)</h3>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Line</th>
              <th>Type</th>
              <th>Done row</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sv.lines.map((l, i) => (
              <tr key={l.id}>
                <td>{l.label}</td>
                <td>{LINE_TYPE_LABELS[l.type]}</td>
                <td>{l.has_done ? l.done_label || `${l.label} done` : '—'}</td>
                <td>
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => run(() => move(i, -1))} aria-label="Move up">
                      ↑
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={i === sv.lines.length - 1}
                      onClick={() => run(() => move(i, 1))}
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ id: l.id, label: l.label, type: l.type, has_done: l.has_done, done_label: l.done_label ?? '' })}>
                      Edit
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        if (window.confirm(`Delete the ${l.label} line and all its targets and results?`)) {
                          void run(async () => {
                            await deleteLine(session.token, l.id)
                            await onSaved()
                          })
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void run(async () => {
            await upsertLine(session.token, {
              id: editing.id,
              termId,
              studentId: sv.student.id,
              label: editing.label,
              type: editing.type,
              hasDone: editing.has_done,
              doneLabel: editing.done_label || null,
            })
            setEditing(EMPTY_LINE)
            await onSaved()
          })
        }}
      >
        <h4>{editing.id ? 'Edit line' : 'Add a line'}</h4>
        <div className="flex gap-3 flex-wrap">
          <div className="field">
            <label htmlFor="ln-label">Label</label>
            <input id="ln-label" value={editing.label ?? ''} onChange={(e) => setEditing({ ...editing, label: e.target.value })} required />
          </div>
          <div className="field">
            <label htmlFor="ln-type">Type</label>
            <select id="ln-type" value={editing.type} onChange={(e) => setEditing({ ...editing, type: e.target.value as LineType })}>
              {LINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {LINE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ln-done">Done row label</label>
            <input
              id="ln-done"
              value={editing.done_label ?? ''}
              placeholder={`${editing.label || 'Line'} done`}
              disabled={!editing.has_done}
              onChange={(e) => setEditing({ ...editing, done_label: e.target.value })}
            />
          </div>
        </div>
        <label className="tick-box" style={{ marginBottom: 8 }}>
          <input type="checkbox" checked={editing.has_done ?? true} onChange={(e) => setEditing({ ...editing, has_done: e.target.checked })} />
          <span>Has a “done” row (results are marked on it)</span>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary btn-sm">
            {editing.id ? 'Save line' : 'Add line'}
          </button>
          {editing.id && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(EMPTY_LINE)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

/** S6 / A2: earlier terms stay viewable as history. */
function History({ studentId, currentTermId }: { studentId: string; currentTermId: number }) {
  const { session } = useAuth()
  const { today } = useTerm()
  const [terms, setTerms] = useState<TermPayload[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!session) return null
  const earlier = terms?.filter((t) => t.term.id !== currentTermId) ?? []
  return (
    <div className="card no-print">
      <h3 className="mt-0">Earlier terms</h3>
      {terms === null ? (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            getStudentHistory(session.token, studentId)
              .then(setTerms)
              .catch((e) => setError(e instanceof Error ? e.message : 'Could not load history.'))
          }
        >
          Show earlier terms
        </button>
      ) : earlier.length === 0 ? (
        <p className="muted">No earlier terms.</p>
      ) : (
        earlier.map((p) => {
          const v = buildTermView(p, today)
          const s = v.students[0]
          if (!s) return null
          return (
            <div key={p.term.id} style={{ marginBottom: 16 }}>
              <h4>
                {p.term.name} · {s.totals.totalMemorised} pages memorised · attendance {s.totals.attendancePct ?? '—'}%
              </h4>
              <StudentSheet sv={s} weeks={p.weeks} currentWeek={0} />
            </div>
          )
        })
      )}
      {error && <ErrorBanner text={error} />}
    </div>
  )
}
