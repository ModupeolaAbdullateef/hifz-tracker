import { useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner } from '../../components/LoadingAndEmpty'
import { exportClass } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useCourse } from '../../context/CourseContext'

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','))
  }
  return lines.join('\n')
}

export default function ExportCsv() {
  const { session } = useAuth()
  const { course } = useCourse()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    if (!session || !course) return
    setBusy(true)
    setError(null)
    try {
      const rows = await exportClass(session.token, course.id)
      const csv = toCsv(rows)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const slug = course.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'course'
      a.download = `${slug}-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export the class.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Export {course?.name ?? 'class'}</h2>
        <p className="muted">
          Downloads one row per student per week, one column per field, for the course selected above.
        </p>
        {error && <ErrorBanner text={error} />}
        <button className="btn btn-primary" onClick={handleExport} disabled={busy || !course}>
          {busy ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>
    </AdminGuard>
  )
}
