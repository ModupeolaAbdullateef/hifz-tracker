import { useEffect, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import { getRecordFieldsAdmin, upsertRecordField } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import type { RecordField } from '../../lib/types'

const emptyForm = { key: '', label: '', type: 'number' as 'number' | 'yesno', unit: '', active: true }

export default function RecordFields() {
  const { session } = useAuth()
  const [fields, setFields] = useState<RecordField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  async function load() {
    if (!session) return
    setLoading(true)
    try {
      const rows = await getRecordFieldsAdmin(session.token)
      setFields(rows.sort((a, b) => a.sort_order - b.sort_order))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load fields.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  function startEdit(f: RecordField) {
    setEditingKey(f.key)
    setForm({ key: f.key, label: f.label, type: f.type, unit: f.unit ?? '', active: f.active })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    setError(null)
    setMessage(null)
    try {
      const sortOrder = editingKey
        ? fields.find((f) => f.key === editingKey)?.sort_order ?? fields.length
        : fields.length
      await upsertRecordField(session.token, {
        key: form.key.trim(),
        label: form.label.trim(),
        type: form.type,
        unit: form.unit.trim() ? form.unit.trim() : null,
        sortOrder,
        active: form.active,
      })
      setMessage('Field saved.')
      setForm(emptyForm)
      setEditingKey(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this field.')
    }
  }

  async function move(f: RecordField, direction: -1 | 1) {
    if (!session) return
    const idx = fields.findIndex((x) => x.key === f.key)
    const swapIdx = idx + direction
    if (swapIdx < 0 || swapIdx >= fields.length) return
    const other = fields[swapIdx]
    await Promise.all([
      upsertRecordField(session.token, {
        key: f.key,
        label: f.label,
        type: f.type,
        unit: f.unit,
        sortOrder: other.sort_order,
        active: f.active,
      }),
      upsertRecordField(session.token, {
        key: other.key,
        label: other.label,
        type: other.type,
        unit: other.unit,
        sortOrder: f.sort_order,
        active: other.active,
      }),
    ])
    await load()
  }

  async function toggleActive(f: RecordField) {
    if (!session) return
    await upsertRecordField(session.token, {
      key: f.key,
      label: f.label,
      type: f.type,
      unit: f.unit,
      sortOrder: f.sort_order,
      active: !f.active,
    })
    await load()
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">{editingKey ? 'Edit field' : 'Add field'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="key">Key (snake_case, no spaces)</label>
              <input
                id="key"
                value={form.key}
                onChange={(e) => setForm((f) => ({ ...f, key: e.target.value }))}
                disabled={!!editingKey}
                required
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="label">Label</label>
              <input
                id="label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="type">Type</label>
              <select
                id="type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'number' | 'yesno' }))}
              >
                <option value="number">Number</option>
                <option value="yesno">Yes / No</option>
              </select>
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="unit">Unit (optional)</label>
              <input id="unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
            </div>
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              {editingKey ? 'Save changes' : 'Add field'}
            </button>
            {editingKey && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingKey(null)
                  setForm(emptyForm)
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="card">
        <h3 className="mt-0">Fields</h3>
        {loading ? (
          <LoadingState />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Active</th>
                  <th>Order</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => (
                  <tr key={f.key}>
                    <td>{f.label}</td>
                    <td>{f.type}</td>
                    <td>{f.unit ?? '—'}</td>
                    <td>{f.active ? 'Yes' : 'No'}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(f, -1)}>
                        ↑
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={i === fields.length - 1}
                        onClick={() => move(f, 1)}
                      >
                        ↓
                      </button>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button className="btn btn-ghost btn-sm" onClick={() => startEdit(f)}>
                          Edit
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(f)}>
                          {f.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="field-hint">Existing recorded data is never deleted when a field is renamed or deactivated.</p>
      </div>
    </AdminGuard>
  )
}
