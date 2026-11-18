/** A9: Overview and student records as an Excel workbook. */
import { formatUKDate } from '../lib/dates'
import { doneText } from './components'
import { doneRowLabel, type StudentView, type TermView } from './model'
import { isRevisionLine } from './rules'

type Row = (string | number | null)[]

function overviewRows(view: TermView): Row[] {
  const weeks = view.payload.weeks
  const head: Row = ['ID', 'Name', 'Pages before term', ...weeks.map((w) => `W${w.week_number} ${formatUKDate(w.class_date)}`),
    'Total memorised', 'Expected by now', 'Total projected', 'Status', 'Weeks absent', 'Attendance %', 'Paid']
  const rows: Row[] = [head]
  for (const sv of view.students) {
    const nh = sv.lines.find((l) => l.type === 'new_hifdh')
    rows.push([
      sv.student.code,
      sv.student.display_name,
      Number(sv.student.pages_before),
      ...weeks.map((w) => {
        if (w.cancelled) return 'No class'
        if (sv.absentWeeks.has(w.week_number)) return 'Absent'
        const c = nh ? sv.cells.get(nh.id)?.find((x) => x.week === w.week_number) : undefined
        return c ? doneText(c) : ''
      }),
      sv.totals.totalMemorised,
      sv.totals.expectedByNow,
      sv.totals.totalProjected,
      sv.totals.status ?? '',
      sv.totals.weeksAbsent,
      sv.totals.attendancePct,
      sv.student.paid ? 'Y' : 'N',
    ])
  }
  return rows
}

export function studentRows(sv: StudentView, view: TermView): Row[] {
  const weeks = view.payload.weeks
  const rows: Row[] = [
    [sv.student.display_name, sv.student.code],
    ['Revision partner', sv.partners.join(' & ')],
    ['Total memorised', sv.totals.totalMemorised, 'Expected by now', sv.totals.expectedByNow, 'Status', sv.totals.status ?? ''],
    ['Attendance %', sv.totals.attendancePct, 'Weeks absent', sv.totals.weeksAbsent],
    [],
    ['Week', ...weeks.map((w) => w.week_number)],
    ['Date', ...weeks.map((w) => formatUKDate(w.class_date))],
    ['Juz', ...weeks.map((w) => sv.juz.get(w.week_number) ?? '')],
  ]
  for (const line of sv.lines) {
    if (line.type === 'juz') continue
    const cells = sv.cells.get(line.id) ?? []
    rows.push([line.label, ...cells.map((c) => (c.cancelled ? 'No class' : c.plan ?? ''))])
    if (isRevisionLine(line)) rows.push(['Revise this week', ...cells.map((c) => (c.cancelled ? '' : c.target ?? ''))])
    if (line.has_done) rows.push([doneRowLabel(line), ...cells.map((c) => (c.cancelled ? '' : doneText(c)))])
  }
  if (sv.notes.length) {
    rows.push([], ['Notes'])
    for (const n of sv.notes) rows.push([new Date(n.created_at).toLocaleDateString('en-GB'), n.author, n.text])
  }
  return rows
}

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28).trim() || 'Sheet'
  let n = base
  let i = 2
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${i++}`
  used.add(n.toLowerCase())
  base = n
  return base
}

export async function downloadWorkbook(view: TermView, groupName: string, studentIds: string[] | 'all', includeOverview: boolean) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  if (includeOverview) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overviewRows(view)), safeSheetName('Overview', used))
  const students = studentIds === 'all' ? view.students : view.students.filter((s) => studentIds.includes(s.student.id))
  for (const sv of students) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(studentRows(sv, view)), safeSheetName(`${sv.student.code} ${sv.student.display_name}`, used))
  }
  const slug = `${groupName} ${view.payload.term.name}`.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
  XLSX.writeFile(wb, `${slug || 'hifdh'}-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
