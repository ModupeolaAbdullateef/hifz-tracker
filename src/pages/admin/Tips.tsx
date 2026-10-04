import { useEffect, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import { deleteTip, getAllTipsAdmin, upsertTip } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { Tip } from '../../lib/types'

const emptyForm = { id: undefined as string | undefined, category: 'technique' as Tip['category'], text: '', active: true }

export default function Tips() {
  const { session } = useAuth()
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    if (!session) return
    setLoading(true)
    try {
      const rows = await getAllTipsAdmin(session.token)
      setTips(rows.sort((a, b) => a.sort_order - b.sort_order))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load tips.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      await upsertTip(session.token, {
        id: form.id,
        category: form.category,
        text: form.text.trim(),
        active: form.active,
        sortOrder: form.id ? tips.find((t) => t.id === form.id)?.sort_order ?? tips.length : tips.length,
      })
      setMessage('Tip saved.')
      setForm(emptyForm)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this tip.')
    }
  }

  async function handleDelete(id: string) {
    if (!session) return
    await deleteTip(session.token, id)
    await load()
  }

  function startEdit(t: Tip) {
    setForm({ id: t.id, category: t.category, text: t.text, active: t.active })
  }

  async function toggleActive(t: Tip) {
    if (!session) return
    await upsertTip(session.token, {
      id: t.id,
      category: t.category,
      text: t.text,
      active: !t.active,
      sortOrder: t.sort_order,
    })
    await load()
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">{form.id ? 'Edit tip' : 'Add tip'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="category">Category</label>
            <select
              id="category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Tip['category'] }))}
            >
              <option value="technique">Technique</option>
              <option value="schedule">Schedule</option>
              <option value="announcement">Announcement</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="text">Text</label>
            <textarea id="text" value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))} required />
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save changes' : 'Add tip'}
            </button>
            {form.id && (
              <button type="button" className="btn btn-ghost" onClick={() => setForm(emptyForm)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="mt-0">Tips</h3>
        {loading ? (
          <LoadingState />
        ) : (
          <ul className="search-results">
            {tips.map((t) => (
              <li key={t.id}>
                <div className="flex-between" style={{ padding: '0.75rem 1rem' }}>
                  <div>
                    <span className="pill pill--ontrack">{t.category}</span> {t.text}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(t)}>
                      {t.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminGuard>
  )
}
