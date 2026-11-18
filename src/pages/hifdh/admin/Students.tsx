import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminGuard from '../../../components/AdminGuard'
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import {
  deleteStudent,
  exportStudentData,
  getAdminStudents,
  removeEnrolment,
  resetPin,
  setStudentStatus,
  upsertStudent,
} from '../../../hifdh/api'
import { copyText, studentLink } from '../../../hifdh/components'
import { compareNames } from '../../../hifdh/rules'
import { useTerm } from '../../../hifdh/TermContext'
import { DEFAULT_TEMPLATE_LABELS, LINE_TEMPLATES, type AdminStudent } from '../../../hifdh/types'

function nextCode(students: AdminStudent[], prefix: string): string {
  const nums = students
    .map((s) => new RegExp(`^${prefix}(\\d+)$`, 'i').exec(s.code))
    .filter(Boolean)
    .map((m) => Number(m![1]))
  const next = (nums.length ? Math.max(...nums) : 0) + 1
  return `${prefix}${String(next).padStart(2, '0')}`
}

const emptyForm = {
  id: null as string | null,
  displayName: '',
  code: '',
  notes: '',
  pagesBefore: '',
  startingJuz: '',
  templates: DEFAULT_TEMPLATE_LABELS,
}

export default function Students() {
  const { session } = useAuth()
  const { group, term, reloadTerm } = useTerm()
  const [students, setStudents] = useState<AdminStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [created, setCreated] = useState<{ name: string; link: string; pin: string } | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [showPin, setShowPin] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const prefix = (group?.name ?? 'S').charAt(0).toUpperCase()

  const load = useCallback(async () => {
    if (!session || !group) return
    setLoading(true)
    try {
      setStudents(await getAdminStudents(session.token, group.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load students.')
    } finally {
      setLoading(false)
    }
  }, [session, group])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return [...students]
      .filter((s) => !q || s.display_name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .sort((a, b) => compareNames(a.display_name, b.display_name))
  }, [students, filter])

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !group) return
    await run(async () => {
      const isNew = !form.id
      const res = await upsertStudent(session.token, {
        id: form.id,
        groupId: group.id,
        code: form.code || nextCode(students, prefix),
        displayName: form.displayName,
        notes: form.notes || null,
        termId: isNew && term ? term.id : null,
        pagesBefore: form.pagesBefore === '' ? null : Number(form.pagesBefore),
        startingJuz: form.startingJuz === '' ? null : Number(form.startingJuz),
        lines: isNew ? LINE_TEMPLATES.filter((t) => form.templates.includes(t.label)) : [],
      })
      if (isNew) {
        setCreated({ name: form.displayName, link: studentLink(res.link_token), pin: res.pin })
      } else {
        setMessage(`${form.displayName} updated everywhere. Their link and PIN are unchanged.`)
      }
      setForm(emptyForm)
      await Promise.all([load(), reloadTerm()])
    })
  }

  async function enrol(s: AdminStudent) {
    if (!session || !term || !group) return
    await run(async () => {
      await upsertStudent(session.token, {
        id: s.id,
        groupId: group.id,
        code: s.code,
        displayName: s.display_name,
        notes: s.notes,
        termId: term.id,
        pagesBefore: null,
        startingJuz: null,
        lines: LINE_TEMPLATES.filter((t) => DEFAULT_TEMPLATE_LABELS.includes(t.label)),
      })
      setMessage(`${s.display_name} added to ${term.name} with the standard lines.`)
      await Promise.all([load(), reloadTerm()])
    })
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">{form.id ? 'Edit student' : `Add a student to ${group.name}`}</h2>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3 flex-wrap">
            <div className="field" style={{ flex: 2, minWidth: 200 }}>
              <label htmlFor="st-name">Name</label>
              <input id="st-name" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 100 }}>
              <label htmlFor="st-code">ID</label>
              <input
                id="st-code"
                value={form.code}
                placeholder={nextCode(students, prefix)}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
          {!form.id && (
            <>
              <div className="flex gap-3 flex-wrap">
                <div className="field">
                  <label htmlFor="st-pages">Pages memorised before term</label>
                  <input id="st-pages" type="number" step={0.5} value={form.pagesBefore} onChange={(e) => setForm({ ...form, pagesBefore: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor="st-juz">Starting juz</label>
                  <input id="st-juz" type="number" min={1} max={30} value={form.startingJuz} onChange={(e) => setForm({ ...form, startingJuz: e.target.value })} />
                </div>
              </div>
              <fieldset className="field" style={{ border: 'none', padding: 0 }}>
                <legend>Lines to create {term ? `in ${term.name}` : '(create a term first)'}</legend>
                <div className="flex gap-2 flex-wrap">
                  {LINE_TEMPLATES.map((t) => (
                    <label key={t.label} className="tick-box">
                      <input
                        type="checkbox"
                        checked={form.templates.includes(t.label)}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            templates: e.target.checked ? [...form.templates, t.label] : form.templates.filter((x) => x !== t.label),
                          })
                        }
                      />
                      <span>{t.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          <div className="field">
            <label htmlFor="st-notes">Admin notes (not shown to the student)</label>
            <textarea id="st-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">
              {form.id ? 'Save changes' : 'Add student'}
            </button>
            {form.id && (
              <button type="button" className="btn btn-ghost" onClick={() => setForm(emptyForm)}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {created && <NewStudentCard {...created} onClose={() => setCreated(null)} />}
      </div>

      <div className="card">
        <div className="flex-between flex-wrap gap-2">
          <h2 className="mt-0">{group.name} students</h2>
          <input aria-label="Find a student" placeholder="Find…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ maxWidth: 200 }} />
        </div>
        {loading ? (
          <LoadingState />
        ) : sorted.length === 0 ? (
          <EmptyState text="No students yet." />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => {
                  const inTerm = term ? s.term_ids.includes(term.id) : false
                  return (
                    <tr key={s.id}>
                      <td>{s.code}</td>
                      <td>
                        {inTerm ? <Link to={`/staff/student/${s.id}`}>{s.display_name}</Link> : s.display_name}
                        {term && !inTerm && <div className="field-hint">Not in {term.name}</div>}
                      </td>
                      <td>
                        <span className={`chip ${s.status === 'left' ? 'chip--left' : ''}`}>{s.status}</span>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => run(async () => {
                              await copyText(studentLink(s.link_token))
                              setMessage(`Link for ${s.display_name} copied.`)
                            })}
                          >
                            Copy link
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setShowPin((prev) => {
                                const n = new Set(prev)
                                if (n.has(s.id)) n.delete(s.id)
                                else n.add(s.id)
                                return n
                              })
                            }
                          >
                            {showPin.has(s.id) ? `PIN ${s.pin}` : 'Show PIN'}
                          </button>
                        </div>
                      </td>
                      <td>
                        <div className="flex gap-1 flex-wrap">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              setForm({ ...emptyForm, id: s.id, displayName: s.display_name, code: s.code, notes: s.notes ?? '' })
                            }
                          >
                            Edit / rename
                          </button>
                          {s.status === 'active' ? (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                run(async () => {
                                  await setStudentStatus(session!.token, s.id, 'left')
                                  setMessage(`${s.display_name} marked as left and removed from revision pairs. Their record stays visible this term.`)
                                  await Promise.all([load(), reloadTerm()])
                                })
                              }
                            >
                              Mark left
                            </button>
                          ) : (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() =>
                                run(async () => {
                                  await setStudentStatus(session!.token, s.id, 'active')
                                  await Promise.all([load(), reloadTerm()])
                                })
                              }
                            >
                              Make active
                            </button>
                          )}
                          {s.status === 'left' && (
                            <button
                              className="btn btn-ghost btn-sm"
                              title="After the term ends: hides them everywhere"
                              onClick={() =>
                                run(async () => {
                                  await setStudentStatus(session!.token, s.id, 'archived')
                                  await Promise.all([load(), reloadTerm()])
                                })
                              }
                            >
                              Archive
                            </button>
                          )}
                          {term && !inTerm && s.status !== 'archived' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => enrol(s)}>
                              Add to {term.name}
                            </button>
                          )}
                          {term && inTerm && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                if (window.confirm(`Remove ${s.display_name} from ${term.name}? Their lines and results for this term will be deleted.`)) {
                                  void run(async () => {
                                    await removeEnrolment(session!.token, term.id, s.id)
                                    await Promise.all([load(), reloadTerm()])
                                  })
                                }
                              }}
                            >
                              Remove from term
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              run(async () => {
                                const pin = await resetPin(session!.token, s.id)
                                setShowPin((prev) => new Set(prev).add(s.id))
                                setMessage(`New PIN for ${s.display_name}: ${pin}. Their link is unchanged.`)
                                await load()
                              })
                            }
                          >
                            New PIN
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="UK GDPR: download everything held about this student"
                            onClick={() =>
                              run(async () => {
                                const data = await exportStudentData(session!.token, s.id)
                                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                                const a = document.createElement('a')
                                a.href = URL.createObjectURL(blob)
                                a.download = `${s.code}-${s.display_name.replace(/\W+/g, '-')}-data.json`
                                a.click()
                                URL.revokeObjectURL(a.href)
                              })
                            }
                          >
                            Export data
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              if (window.confirm(`Permanently delete ${s.display_name} and ALL their records, notes and history? This cannot be undone.`)) {
                                void run(async () => {
                                  await deleteStudent(session!.token, s.id)
                                  setMessage(`${s.display_name} deleted.`)
                                  await Promise.all([load(), reloadTerm()])
                                })
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminGuard>
  )
}

function NewStudentCard({ name, link, pin, onClose }: { name: string; link: string; pin: string; onClose: () => void }) {
  const message = `Assalamu alaikum ${name}. Your Hifdh record: ${link} \nYour PIN: ${pin}`
  return (
    <div className="warning-box" style={{ marginTop: 16 }}>
      <p className="mt-0">
        <strong>{name} added.</strong> Send them their personal link and PIN:
      </p>
      <div className="copy-row">
        <code>{link}</code>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(link)}>
          Copy link
        </button>
      </div>
      <p>
        PIN: <strong style={{ fontSize: '1.2rem', letterSpacing: 2 }}>{pin}</strong>
      </p>
      <div className="flex gap-2 flex-wrap">
        <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
          Send on WhatsApp
        </a>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}
