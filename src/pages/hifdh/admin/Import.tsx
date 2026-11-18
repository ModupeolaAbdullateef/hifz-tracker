import { useState } from 'react'
import AdminGuard from '../../../components/AdminGuard'
import { ErrorBanner, SuccessBanner } from '../../../components/LoadingAndEmpty'
import { useAuth } from '../../../context/AuthContext'
import { formatUKDate } from '../../../lib/dates'
import { importTerm } from '../../../hifdh/api'
import { parseWorkbook, readWorkbook, type ImportPreview } from '../../../hifdh/importExcel'
import { buildTermView } from '../../../hifdh/model'
import { useTerm } from '../../../hifdh/TermContext'
import type { TermPayload } from '../../../hifdh/types'

interface Mismatch {
  name: string
  field: string
  excel: string
  portal: string
}

/** Runs the portal's rules over the parsed sheet and lists where they disagree with Excel's own totals. */
function compareWithExcel(preview: ImportPreview, today: string): Mismatch[] {
  const payload: TermPayload = {
    term: { id: 0, group_id: 0, name: '', start_date: preview.dates[0] ?? today, archived: false },
    weeks: preview.dates.map((d, i) => ({ week_number: i + 1, class_date: d, cancelled: false })),
    students: preview.students.map((s) => ({
      id: s.code,
      code: s.code,
      display_name: s.display_name,
      status: 'active',
      notes: null,
      is_teacher: false,
      pages_before: s.pages_before,
      projected_override: null,
      paid: false,
      exception_from: null,
      exception_until: null,
    })),
    lines: preview.students.flatMap((s) =>
      s.lines.map((l, i) => ({
        id: `${s.code}:${i}`,
        student_id: s.code,
        label: l.label,
        type: l.type,
        sort_order: i,
        has_done: l.has_done,
        done_label: l.done_label,
      })),
    ),
    targets: preview.students.flatMap((s) =>
      s.lines.flatMap((l, i) => Object.entries(l.targets).map(([w, t]) => ({ line_id: `${s.code}:${i}`, week: Number(w), plan: t, override: null }))),
    ),
    results: preview.students.flatMap((s) =>
      s.lines.flatMap((l, i) =>
        Object.entries(l.results).map(([w, r]) => ({ line_id: `${s.code}:${i}`, week: Number(w), value: r.value, initials: r.initials, note: null })),
      ),
    ),
    attendance: preview.students.flatMap((s) => s.absent_weeks.map((w) => ({ student_id: s.code, week: w, absent: true, initials: null }))),
    pairs: [],
    notes: [],
    selfchecks: [],
  }
  const view = buildTermView(payload, today)
  const out: Mismatch[] = []
  for (const s of preview.students) {
    const sv = view.byId.get(s.code)
    if (!sv) continue
    const t = sv.totals
    const check = (field: string, excel: number | string | null, portal: number | string | null) => {
      if (excel === null || excel === '') return
      const same = typeof excel === 'number' && typeof portal === 'number' ? Math.abs(excel - portal) < 0.01 : String(excel).toLowerCase() === String(portal ?? '').toLowerCase()
      if (!same) out.push({ name: s.display_name, field, excel: String(excel), portal: portal === null ? '—' : String(portal) })
    }
    check('Total memorised', s.excel.totalMemorised, t.totalMemorised)
    check('Expected by now', s.excel.expected, t.expectedByNow)
    check('Total projected', s.excel.projected, t.totalProjected)
    check('Status', s.excel.status, t.status)
    check('Weeks absent', s.excel.weeksAbsent, t.weeksAbsent)
    check('Attendance %', s.excel.attendance, t.attendancePct)
  }
  return out
}

/** A1: one-time import of the Brothers and Sisters record sheets. */
export default function Import() {
  const { session } = useAuth()
  const { groups, today, reloadBoot, selectGroup, selectTerm } = useTerm()
  const [groupId, setGroupId] = useState<number>(groups[0]?.id ?? 0)
  const [termName, setTermName] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [mismatches, setMismatches] = useState<Mismatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    setMessage(null)
    setPreview(null)
    setBusy(true)
    try {
      const guess = groups.find((g) => file.name.toLowerCase().includes(g.name.toLowerCase()))
      if (guess) setGroupId(guess.id)
      const p = await parseWorkbook(await readWorkbook(file))
      setPreview(p)
      setMismatches(compareWithExcel(p, today))
      if (!termName && p.dates[0]) setTermName(`Term from ${formatUKDate(p.dates[0])}`)
    } catch (e) {
      setError(e instanceof Error ? `Could not read that file: ${e.message}` : 'Could not read that file.')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!session || !preview) return
    setBusy(true)
    setError(null)
    try {
      const res = await importTerm(session.token, {
        group_id: groupId,
        term_name: termName,
        dates: preview.dates,
        students: preview.students.map(({ excel: _excel, ...s }) => s),
        pairs: preview.pairs,
      })
      await reloadBoot()
      selectGroup(groupId)
      if (res.term_id) selectTerm(res.term_id)
      setMessage(
        `Imported ${res.students} students, ${res.lines} lines, ${res.targets} targets, ${res.results} results, ${res.notes} notes and ${res.pairs} revision pairs. Each student has a personal link and PIN on the Students tab.`,
      )
      setPreview(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Import from Excel</h2>
        <p className="muted">
          Upload “Record sheets - Brothers.xlsx” or “Record sheets - Sisters.xlsx”. Students are matched by their ID (column T),
          so importing again updates them rather than making copies. Nothing is saved until you press Import.
        </p>
        <div className="flex gap-3 flex-wrap">
          <div className="field">
            <label htmlFor="im-file">Workbook</label>
            <input
              id="im-file"
              type="file"
              accept=".xlsx,.xlsm,.xls"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>
          <div className="field">
            <label htmlFor="im-group">Group</label>
            <select id="im-group" value={groupId} onChange={(e) => setGroupId(Number(e.target.value))}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}>
            <label htmlFor="im-term">Term name</label>
            <input id="im-term" value={termName} onChange={(e) => setTermName(e.target.value)} />
          </div>
        </div>
        {busy && <p className="muted">Working…</p>}
        {error && <ErrorBanner text={error} />}
        {message && <SuccessBanner text={message} />}
      </div>

      {preview && (
        <div className="card">
          <h2 className="mt-0">Preview</h2>
          <div className="st-stats">
            {Object.entries(preview.counts).map(([k, v]) => (
              <div className="st-stat" key={k}>
                <span className="st-stat__value">{v}</span>
                <span className="st-stat__label">{k}</span>
              </div>
            ))}
          </div>
          <p>
            {preview.dates.length} class dates: {preview.dates.map(formatUKDate).join(', ')}
          </p>

          <h3>Rows that could not be read ({preview.issues.length})</h3>
          {preview.issues.length === 0 ? (
            <p className="muted">None.</p>
          ) : (
            <ul>
              {preview.issues.slice(0, 100).map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}

          <h3>Check against Excel’s own totals ({mismatches.length} differences)</h3>
          {mismatches.length === 0 ? (
            <p className="muted">Every student's totals, status and attendance match the sheet (as of today).</p>
          ) : (
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Figure</th>
                    <th>Excel</th>
                    <th>Portal</th>
                  </tr>
                </thead>
                <tbody>
                  {mismatches.slice(0, 200).map((m, i) => (
                    <tr key={i}>
                      <td>{m.name}</td>
                      <td>{m.field}</td>
                      <td>{m.excel}</td>
                      <td>{m.portal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="field-hint">
            Differences can come from the sheet being saved on an earlier day (Expected by now and attendance depend on the date) or from
            rows the importer couldn't read. Check a few before importing.
          </p>

          <details>
            <summary>Students found ({preview.students.length})</summary>
            <ul>
              {preview.students.map((s) => (
                <li key={s.code}>
                  {s.code} · {s.display_name} · {s.lines.length} lines · {s.pages_before} pages before
                </li>
              ))}
            </ul>
          </details>

          <div className="flex gap-2" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleImport} disabled={busy || !termName.trim() || preview.dates.length === 0}>
              Import into {groups.find((g) => g.id === groupId)?.name}
            </button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </AdminGuard>
  )
}
