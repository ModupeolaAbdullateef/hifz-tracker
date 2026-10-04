import { useEffect, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import { deleteInterest, getInterestAdmin, getNotifyEmail, setInterestStatus, setNotifyEmail } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { InterestStatus, InterestSubmission } from '../../lib/types'

const FOR_LABELS: Record<InterestSubmission['interested_for'], string> = {
  myself: 'Themself',
  my_child: 'Their child',
  other: 'Someone else',
}

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', dateStyle: 'medium', timeStyle: 'short' })

export default function Enquiries() {
  const { session } = useAuth()
  const [rows, setRows] = useState<InterestSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<InterestStatus | 'all'>('new')
  const [notifyEmail, setNotifyEmailInput] = useState('')
  const [notifyMessage, setNotifyMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  async function load() {
    if (!session) return
    setLoading(true)
    try {
      setRows(await getInterestAdmin(session.token))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load enquiries.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    if (session) getNotifyEmail(session.token).then((e) => setNotifyEmailInput(e ?? '')).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function handleSaveNotify(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)
    setNotifyMessage(null)
    try {
      await setNotifyEmail(session.token, notifyEmail.trim())
      setNotifyMessage(notifyEmail.trim() ? 'Notification email saved.' : 'Email notifications turned off.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the email.')
    }
  }

  async function changeStatus(id: string, status: InterestStatus) {
    if (!session) return
    await setInterestStatus(session.token, id, status)
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  async function handleDelete(id: string) {
    if (!session) return
    await deleteInterest(session.token, id)
    setConfirmDelete(null)
    setRows((rs) => rs.filter((r) => r.id !== id))
  }

  const counts = {
    new: rows.filter((r) => r.status === 'new').length,
    contacted: rows.filter((r) => r.status === 'contacted').length,
    archived: rows.filter((r) => r.status === 'archived').length,
    all: rows.length,
  }
  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Enquiry notifications</h2>
        <p className="muted">Each new interest form submission is emailed to this address. Leave blank to turn emails off.</p>
        <form onSubmit={handleSaveNotify} className="flex gap-2 flex-wrap" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 240px', marginBottom: 0 }}>
            <label htmlFor="notify">Admin email</label>
            <input id="notify" type="email" value={notifyEmail} onChange={(e) => setNotifyEmailInput(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </form>
        {notifyMessage && <div style={{ marginTop: '1rem' }}><SuccessBanner text={notifyMessage} /></div>}
      </div>

      <div className="card">
        <div className="flex-between flex-wrap">
          <h3 className="mt-0">Enquiries</h3>
          <div className="toggle-group" role="group" aria-label="Filter enquiries">
            {(['new', 'contacted', 'archived', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={filter === f ? 'is-active' : ''}
                data-variant="filter"
                onClick={() => setFilter(f)}
              >
                {f[0].toUpperCase() + f.slice(1)} ({counts[f]})
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorBanner text={error} />}
        {loading ? (
          <LoadingState />
        ) : visible.length === 0 ? (
          <EmptyState text={filter === 'new' ? 'No new enquiries.' : 'Nothing here.'} />
        ) : (
          <ul className="enquiry-list">
            {visible.map((r) => (
              <li key={r.id} className="enquiry">
                <div className="flex-between flex-wrap">
                  <div>
                    <strong>{r.full_name}</strong>{' '}
                    <span className={`pill pill--status-${r.status}`}>{r.status}</span>
                    <div className="muted enquiry__meta">
                      {dateFmt.format(new Date(r.created_at))} · For {FOR_LABELS[r.interested_for].toLowerCase()}
                    </div>
                  </div>
                </div>
                <div className="enquiry__contact">
                  <span>
                    ✉️ <a href={`mailto:${r.email}`}>{r.email}</a>
                  </span>
                  {r.phone && (
                    <span>
                      📞 <a href={`tel:${r.phone}`}>{r.phone}</a>
                    </span>
                  )}
                </div>
                {r.message && <p className="enquiry__message">{r.message}</p>}
                <div className="flex gap-2 flex-wrap">
                  {r.status !== 'contacted' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => changeStatus(r.id, 'contacted')}>
                      Mark contacted
                    </button>
                  )}
                  {r.status !== 'new' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(r.id, 'new')}>
                      Mark as new
                    </button>
                  )}
                  {r.status !== 'archived' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => changeStatus(r.id, 'archived')}>
                      Archive
                    </button>
                  )}
                  {confirmDelete === r.id ? (
                    <>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>
                        Confirm delete
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(r.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminGuard>
  )
}
