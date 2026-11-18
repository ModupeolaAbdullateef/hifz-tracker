import { useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner } from '../../components/LoadingAndEmpty'
import { exportClass, getRecordFieldsAdmin } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useCourse } from '../../context/CourseContext'
import type { RecordField } from '../../lib/types'

type Row = Record<string, unknown>
type Column = { header: string; value: (row: Row) => unknown }

function yesNo(v: unknown): string {
  if (v === true) return 'Yes'
  if (v === false) return 'No'
  return ''
}

/** Spreadsheet columns in a fixed, readable order: student, week, attendance, each field, then notes. */
function buildColumns(fields: RecordField[]): Column[] {
  const fieldCols: Column[] = fields.map((f) => ({
    header: f.unit ? `${f.label} (${f.unit})` : f.label,
    value: (row) => (f.type === 'yesno' ? yesNo(row[f.key]) : row[f.key]),
  }))
  return [
    { header: 'First name', value: (r) => r.student_first_name },
    { header: 'Last name', value: (r) => r.student_last_name },
    { header: 'Student code', value: (r) => r.student_code },
    { header: 'Week', value: (r) => r.week_number },
    { header: 'Date', value: (r) => r.class_date },
    {
      header: 'Attendance',
      value: (r) => (r.cancelled ? 'No class' : r.status === 'present' ? 'Present' : r.status === 'absent' ? 'Absent' : ''),
    },
    { header: 'Good week', value: (r) => (r.status ? yesNo(r.good_week) : '') },
    ...fieldCols,
    { header: 'From page', value: (r) => r.hifz_from_page },
    { header: 'To page', value: (r) => r.hifz_to_page },
    { header: 'Note', value: (r) => r.note },
    { header: 'Next homework', value: (r) => r.next_assignment },
    { header: 'Filled in by', value: (r) => r.updated_by },
  ]
}

function toCsv(rows: Row[], columns: Column[]): string {
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [columns.map((c) => escape(c.header)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => escape(c.value(row))).join(','))
  }
  // Excel expects CRLF line endings, and the BOM makes it read names with accents correctly.
  return '﻿' + lines.join('\r\n')
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
      const [rows, allFields] = await Promise.all([
        exportClass(session.token, course.id),
        getRecordFieldsAdmin(session.token, course.id),
      ])
      const fields = [...allFields].sort((a, b) => a.sort_order - b.sort_order)
      const csv = toCsv(rows, buildColumns(fields))
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
          Downloads everything as a spreadsheet that opens in Excel: one line per student for each week, with
          attendance, every field, the teacher's note and next homework.
        </p>
        {error && <ErrorBanner text={error} />}
        <button className="btn btn-primary" onClick={handleExport} disabled={busy || !course}>
          {busy ? 'Preparing…' : 'Download spreadsheet'}
        </button>
      </div>
    </AdminGuard>
  )
}
