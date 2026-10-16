// TEMPORARY: per-page review feedback from the admin. To remove, delete this
// file and src/styles/page-feedback.css, drop <PageFeedback /> from App.tsx,
// and run the drop statements at the top of supabase/page-feedback.sql.
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { formatUKDate } from '../lib/dates'
import '../styles/page-feedback.css'

interface FeedbackItem {
  id: string
  page: string
  message: string
  created_by: string
  created_at: string
}

const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi

/** One key per screen, so every student's progress page shares the same feedback. */
function pageKey(pathname: string) {
  return pathname.replace(UUID_SEGMENT, '/:id').replace(/\/$/, '') || '/'
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export default function PageFeedback() {
  const { session, isAdmin } = useAuth()
  const { pathname } = useLocation()
  const page = pageKey(pathname)

  const [items, setItems] = useState<FeedbackItem[]>([])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const token = session?.token

  const load = useCallback(async () => {
    if (!token) return
    try {
      setItems(await rpc<FeedbackItem[]>('list_page_feedback', { p_token: token, p_page: page }))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [token, page])

  useEffect(() => {
    setItems([])
    setDraft('')
    void load()
  }, [load])

  // The login page has its own way in, so don't send people from there to itself.
  if (!session && pathname === '/staff/login') return null

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!token || !draft.trim()) return
    setSaving(true)
    try {
      await rpc('admin_add_page_feedback', { p_token: token, p_page: page, p_message: draft })
      setDraft('')
      await load()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!token) return
    try {
      await rpc('admin_delete_page_feedback', { p_token: token, p_id: id })
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <aside className="pf" aria-label="Page feedback">
      {open ? (
        <div className="pf__box">
          <div className="pf__head">
            <strong>Feedback</strong>
            <code className="pf__page">{page}</code>
            <button type="button" className="pf__close" onClick={() => setOpen(false)} aria-label="Close feedback">
              ×
            </button>
          </div>

          {!session ? (
            <p className="pf__empty">
              <Link to="/staff/login" state={{ from: pathname }}>
                Log in as staff
              </Link>{' '}
              to see or add feedback on this page.
            </p>
          ) : items.length === 0 ? (
            <p className="pf__empty">No feedback on this page yet.</p>
          ) : (
            <ul className="pf__list">
              {items.map((f) => (
                <li key={f.id} className="pf__item">
                  <p className="pf__msg">{f.message}</p>
                  <div className="pf__meta">
                    <span>
                      {f.created_by} · {formatUKDate(f.created_at.slice(0, 10))}
                    </span>
                    {isAdmin && (
                      <button type="button" className="pf__delete" onClick={() => void remove(f.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isAdmin && (
            <form onSubmit={add} className="pf__form">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Add feedback about this page…"
                maxLength={2000}
                rows={3}
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !draft.trim()}>
                {saving ? 'Saving…' : 'Add feedback'}
              </button>
            </form>
          )}

          {error && <p className="field-error">{error}</p>}
        </div>
      ) : (
        <button type="button" className="pf__toggle" onClick={() => setOpen(true)}>
          Feedback{items.length > 0 && <span className="pf__count">{items.length}</span>}
        </button>
      )}
    </aside>
  )
}
