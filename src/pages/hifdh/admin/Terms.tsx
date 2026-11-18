import { useState } from 'react'
import AdminGuard from '../../../components/AdminGuard'
import { EmptyState, ErrorBanner, SuccessBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import { formatUKDate } from '../../../lib/dates'
import { createTerm, deleteTerm, updateTerm, updateWeek } from '../../../hifdh/api'
import { useTerm } from '../../../hifdh/TermContext'

/** A2: create and run 10-week terms for each group. */
export default function Terms() {
  const { session } = useAuth()
  const { group, terms, term, view, selectTerm, reloadBoot, reloadTerm } = useTerm()
  const [name, setName] = useState('')
  const [start, setStart] = useState('')
  const [copyFrom, setCopyFrom] = useState<string>('latest')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (!group) return <EmptyState text="No group selected." />

  async function run(fn: () => Promise<void>) {
    setError(null)
    setMessage(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  const latest = terms[0]

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">New {group.name} term</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void run(async () => {
              if (!session) return
              const from = copyFrom === 'none' ? null : copyFrom === 'latest' ? latest?.id ?? null : Number(copyFrom)
              const id = await createTerm(session.token, group.id, name, start, from)
              await reloadBoot()
              selectTerm(id)
              setName('')
              setStart('')
              setMessage(`Term created with 10 weekly classes.${from ? ' Every active student’s lines were copied (not results).' : ''}`)
            })
          }}
        >
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 2, minWidth: 200 }}>
              <label htmlFor="tm-name">Name</label>
              <input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Spring 2027" required />
            </div>
            <div className="field">
              <label htmlFor="tm-start">First class date</label>
              <input id="tm-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="tm-copy">Students and lines</label>
            <select id="tm-copy" value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
              {latest && <option value="latest">Copy every student’s lines from {latest.name}</option>}
              {terms.slice(1).map((t) => (
                <option key={t.id} value={t.id}>
                  Copy from {t.name}
                </option>
              ))}
              <option value="none">Start empty</option>
            </select>
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <button type="submit" className="btn btn-primary">
            Create term
          </button>
        </form>
      </div>

      {term && view && (
        <div className="card">
          <div className="flex-between flex-wrap gap-2">
            <h2 className="mt-0">{term.name} · class dates</h2>
            <div className="flex gap-2">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  run(async () => {
                    if (!session) return
                    await updateTerm(session.token, term.id, null, !term.archived)
                    await reloadBoot()
                  })
                }
              >
                {term.archived ? 'Make current again' : 'Move to history'}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (!session) return
                  if (!window.confirm(`Delete ${term.name} and every target and result in it? This cannot be undone.`)) return
                  void run(async () => {
                    await deleteTerm(session.token, term.id)
                    await reloadBoot()
                  })
                }}
              >
                Delete term
              </button>
            </div>
          </div>
          <p className="field-hint">A week counts as passed from the day after its class date. Change a date or cancel a week (e.g. a holiday).</p>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Class date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {view.payload.weeks.map((w) => (
                  <tr key={w.week_number}>
                    <td>{w.week_number}</td>
                    <td>
                      <input
                        type="date"
                        defaultValue={w.class_date}
                        aria-label={`Week ${w.week_number} date`}
                        onBlur={(e) => {
                          if (e.target.value && e.target.value !== w.class_date && session) {
                            void run(async () => {
                              await updateWeek(session.token, term.id, w.week_number, e.target.value, null)
                              await reloadTerm()
                              setMessage(`Week ${w.week_number} moved to ${formatUKDate(e.target.value)}.`)
                            })
                          }
                        }}
                      />
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${w.cancelled ? 'btn-danger' : 'btn-ghost'}`}
                        onClick={() =>
                          run(async () => {
                            if (!session) return
                            await updateWeek(session.token, term.id, w.week_number, null, !w.cancelled)
                            await reloadTerm()
                          })
                        }
                      >
                        {w.cancelled ? 'No class (undo)' : 'Cancel this week'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="mt-0">All {group.name} terms</h2>
        {terms.length === 0 ? (
          <p className="muted">No terms yet.</p>
        ) : (
          <ul>
            {terms.map((t) => (
              <li key={t.id}>
                <button className="btn btn-ghost btn-sm" onClick={() => selectTerm(t.id)}>
                  {t.name}
                </button>{' '}
                <span className="muted">
                  starts {formatUKDate(t.start_date)}
                  {t.archived ? ' · history' : ''}
                  {t.id === term?.id ? ' · selected' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminGuard>
  )
}
