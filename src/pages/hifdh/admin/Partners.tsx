import { useEffect, useMemo, useState } from 'react'
import AdminGuard from '../../../components/AdminGuard'
import { EmptyState, ErrorBanner, SuccessBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import { setPairs } from '../../../hifdh/api'
import type { StudentView } from '../../../hifdh/model'
import { currentWeekNumber, isRevisionLine } from '../../../hifdh/rules'
import { useTerm } from '../../../hifdh/TermContext'

interface DraftPair {
  members: string[] // student ids ('' = empty slot)
}

/** This week's revision portion for a student (their first revision line). */
function revisingNow(sv: StudentView | undefined, week: number): string {
  if (!sv) return ''
  const line = sv.lines.find((l) => isRevisionLine(l) && l.type !== 'half_revision') ?? sv.lines.find((l) => isRevisionLine(l))
  if (!line) return ''
  return sv.cells.get(line.id)?.find((c) => c.week === week)?.target ?? ''
}

/** A7: pair students for revision (pairs or a group of three). */
export default function Partners() {
  const { session } = useAuth()
  const { view, term, group, today, reloadTerm } = useTerm()
  const [draft, setDraft] = useState<DraftPair[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!view) return
    setDraft(view.payload.pairs.map((p) => ({ members: p.members.map((m) => m.student_id ?? '') })))
  }, [view])

  const active = useMemo(() => (view?.students ?? []).filter((s) => s.student.status === 'active'), [view])

  if (!term || !view) return <EmptyState text="No term selected." />

  const week = currentWeekNumber(view.payload.weeks, today)
  const counts = new Map<string, number>()
  for (const p of draft) for (const id of p.members) if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  const notPaired = active.filter((s) => !counts.has(s.student.id))
  const hasDup = [...counts.values()].some((n) => n > 1)
  const isSisters = /sister/i.test(group?.name ?? '')

  function setMember(pairIdx: number, slot: number, id: string) {
    setDraft((d) => d.map((p, i) => (i === pairIdx ? { members: p.members.map((m, j) => (j === slot ? id : m)) } : p)))
  }

  async function save() {
    if (!session || !term) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const pairs = draft
        .map((p) => p.members.filter(Boolean))
        .filter((m) => m.length > 0)
        .map((members, i) => ({
          pair_number: i + 1,
          members: members.map((id) => ({ student_id: id, revising: revisingNow(view!.byId.get(id), week) || null })),
        }))
      await setPairs(session.token, term.id, pairs)
      await reloadTerm()
      setMessage('Revision partners saved. Each student now sees their partner on their record.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminGuard>
      <div className="card no-print">
        <div className="flex-between flex-wrap gap-2">
          <h2 className="mt-0">Revision partners · {group?.name}</h2>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            Print partner cards
          </button>
        </div>
        <p className="field-hint">Based on revision this round. Only active students are listed. A name used twice is shown in red.</p>
        {draft.map((p, i) => (
          <div className="pair-row" key={i}>
            <strong style={{ width: 56 }}>Pair {i + 1}</strong>
            {p.members.map((id, slot) => (
              <span key={slot} className="flex gap-1" style={{ alignItems: 'center' }}>
                <select
                  aria-label={`Pair ${i + 1} member ${slot + 1}`}
                  value={id}
                  className={id && (counts.get(id) ?? 0) > 1 ? 'is-dup' : ''}
                  onChange={(e) => setMember(i, slot, e.target.value)}
                >
                  <option value="">—</option>
                  {active.map((s) => (
                    <option key={s.student.id} value={s.student.id}>
                      {s.student.display_name}
                    </option>
                  ))}
                </select>
                {id && <span className="muted" style={{ fontSize: '0.75rem' }}>{revisingNow(view.byId.get(id), week)}</span>}
              </span>
            ))}
            {p.members.length < 3 && (
              <button className="btn btn-ghost btn-sm" onClick={() => setDraft((d) => d.map((x, j) => (j === i ? { members: [...x.members, ''] } : x)))}>
                + third
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <div className="flex gap-2 flex-wrap" style={{ marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={() => setDraft((d) => [...d, { members: ['', ''] }])}>
            Add pair
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || hasDup}>
            {busy ? 'Saving…' : 'Save partners'}
          </button>
        </div>
        {hasDup && <ErrorBanner text="Someone is in more than one pair. Fix the names in red before saving." />}
        {error && <ErrorBanner text={error} />}
        {message && <SuccessBanner text={message} />}

        <h3>Not paired yet ({notPaired.length})</h3>
        {notPaired.length === 0 ? (
          <p className="muted">Everyone has a partner.</p>
        ) : (
          <p>{notPaired.map((s) => s.student.display_name).join(', ')}</p>
        )}
      </div>

      <div className="print-only">
        <h2 style={{ margin: '0 0 8px' }}>
          Revision Partners · {group?.name} · {term.name}
        </h2>
        <div className={`pair-cards ${isSisters ? 'pair-cards--sisters' : 'pair-cards--brothers'}`}>
          {view.payload.pairs.map((p) => (
            <div className="pair-card" key={p.id}>
              <h4>Pair {p.pair_number}</h4>
              {p.members.map((m) => (
                <div key={m.student_id ?? m.display_name}>
                  <strong>{m.display_name}</strong>
                  {m.revising && <span> · revising {m.revising}</span>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </AdminGuard>
  )
}
