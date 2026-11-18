/**
 * A1: reads a "Record sheets - Brothers/Sisters.xlsx" workbook (layout in
 * section 8.3 of the brief) into the payload hf_import expects.
 *
 * Overview sheet: row 1 week numbers and row 2 dates in F-O; E = pages
 * before term; P-V = Excel's own totals (kept so the preview can show where
 * the portal's figures differ); T = student ID. Each student is a name row
 * followed by their lines, with "... done" rows under item lines.
 */
import type { WorkBook, WorkSheet } from 'xlsx'
import { compareNames, isAbsentWeek, splitValueAndInitials, type LineType } from './rules'

export interface ImportLine {
  label: string
  type: LineType
  has_done: boolean
  done_label: string | null
  targets: Record<string, string>
  results: Record<string, { value: string; initials: string | null; note?: string | null }>
}

export interface ImportStudent {
  code: string
  display_name: string
  pages_before: number
  absent_weeks: number[]
  lines: ImportLine[]
  notes: { author: string; text: string }[]
  excel: { totalMemorised: number | null; expected: number | null; projected: number | null; status: string | null; weeksAbsent: number | null; attendance: number | null }
}

export interface ImportPreview {
  dates: string[]
  students: ImportStudent[]
  pairs: { pair_number: number; members: { code: string; revising: string | null }[] }[]
  issues: string[]
  counts: { students: number; lines: number; targets: number; results: number; notes: number; pairs: number }
}

const COL_LABEL_MAX = 3 // A-D
const COL_PAGES_BEFORE = 4 // E
const COL_WEEK_FIRST = 5 // F
const COL_WEEK_LAST = 14 // O
const COL_TOTAL = 15 // P
const COL_EXPECTED = 16 // Q
const COL_PROJECTED = 17 // R
const COL_STATUS = 18 // S
const COL_ID = 19 // T
const COL_ABSENT = 20 // U
const COL_ATTENDANCE = 21 // V

type Cell = string | number | boolean | Date | null

function text(v: Cell | undefined): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return isoDate(v)
  return String(v).trim()
}

function num(v: Cell | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').trim())
  return Number.isFinite(n) ? n : null
}

function isoDate(d: Date): string {
  // Excel dates arrive as local midnight; use local parts so the day doesn't shift.
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateCell(v: Cell | undefined): string | null {
  if (v instanceof Date) return isoDate(v)
  const s = text(v)
  const uk = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(s)
  if (uk) {
    const y = uk[3].length === 2 ? `20${uk[3]}` : uk[3]
    return `${y}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

export function inferLineType(label: string): LineType {
  const l = label.toLowerCase()
  if (/juz\s*tests?|^tests?$/.test(l)) return 'juz_tests'
  if (/^new\s*hif/.test(l)) return 'new_hifdh'
  if (/planned/.test(l)) return 'planned_pages'
  if (/^juz\b/.test(l)) return 'juz'
  if (/5\s*prev|previous\s*pages|prev(ious)?\s*5/.test(l)) return 'prev5'
  if (/previous\s*half|old\s*half/.test(l)) return 'half_revision'
  if (/^revision/.test(l)) return 'revision'
  return 'custom'
}

const isDoneLabel = (label: string) => /\bdone\s*$/i.test(label) || /^test result/i.test(label)
const isComputedRow = (label: string) => /^revise this week/i.test(label)

function rowLabel(row: Cell[]): string {
  for (let c = 0; c <= COL_LABEL_MAX; c++) {
    const t = text(row[c])
    if (t) return t
  }
  return ''
}

function hasWeekValues(row: Cell[]): boolean {
  for (let c = COL_WEEK_FIRST; c <= COL_WEEK_LAST; c++) if (text(row[c])) return true
  return false
}

function findSheet(wb: WorkBook, pattern: RegExp): WorkSheet | null {
  const name = wb.SheetNames.find((n) => pattern.test(n))
  return name ? wb.Sheets[name] : null
}

/** Comments (including Excel threaded comments) by row index. */
function commentsByRow(ws: WorkSheet, decodeCell: (a: string) => { r: number; c: number }): Map<number, { author: string; text: string }[]> {
  const out = new Map<number, { author: string; text: string }[]>()
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue
    const cell = ws[addr] as { c?: { a?: string; t?: string }[] }
    if (!cell?.c?.length) continue
    const { r } = decodeCell(addr)
    const list = out.get(r) ?? []
    for (const c of cell.c) {
      const t = (c.t ?? '').replace(/^\[Threaded comment\][\s\S]*?Comment:\s*/i, '').trim()
      if (t) list.push({ author: (c.a ?? 'MMA').replace(/^tc=.*$/, 'MMA'), text: t })
    }
    out.set(r, list)
  }
  return out
}

export async function readWorkbook(file: File): Promise<WorkBook> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { cellDates: true })
}

export async function parseWorkbook(wb: WorkBook): Promise<ImportPreview> {
  const XLSX = await import('xlsx')
  const issues: string[] = []
  const ws = findSheet(wb, /overview/i) ?? wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null })
  const comments = commentsByRow(ws, XLSX.utils.decode_cell)

  // Row 1 = week numbers, row 2 = dates (F-O).
  const dates: string[] = []
  for (let c = COL_WEEK_FIRST; c <= COL_WEEK_LAST; c++) {
    const d = parseDateCell(rows[1]?.[c])
    if (d) dates.push(d)
  }
  if (dates.length === 0) issues.push('Could not read the class dates from row 2 (columns F-O).')

  const students: ImportStudent[] = []
  let current: ImportStudent | null = null
  let lastItem: ImportLine | null = null

  for (let r = 2; r < rows.length; r++) {
    const row = rows[r] ?? []
    const label = rowLabel(row)
    const id = text(row[COL_ID])

    if (id && label) {
      current = {
        code: id.toUpperCase(),
        display_name: label,
        pages_before: num(row[COL_PAGES_BEFORE]) ?? 0,
        absent_weeks: [],
        lines: [],
        notes: [],
        excel: {
          totalMemorised: num(row[COL_TOTAL]),
          expected: num(row[COL_EXPECTED]),
          projected: num(row[COL_PROJECTED]),
          status: text(row[COL_STATUS]) || null,
          weeksAbsent: num(row[COL_ABSENT]),
          attendance: (() => {
            const a = num(row[COL_ATTENDANCE])
            return a === null ? null : a <= 1 ? Math.round(a * 100) : Math.round(a)
          })(),
        },
      }
      students.push(current)
      lastItem = null
      for (const n of comments.get(r) ?? []) current.notes.push(n)
      continue
    }

    if (!label) {
      if (hasWeekValues(row)) issues.push(`Row ${r + 1}: has week values but no label, skipped.`)
      continue
    }
    if (!current) {
      if (hasWeekValues(row)) issues.push(`Row ${r + 1} (“${label}”): appears before the first student row, skipped.`)
      continue
    }
    for (const n of comments.get(r) ?? []) current.notes.push(n)
    if (isComputedRow(label)) continue // the portal recalculates these

    const weekCells = (fn: (week: number, v: Cell) => void) => {
      for (let c = COL_WEEK_FIRST; c <= COL_WEEK_LAST; c++) {
        const v = row[c]
        if (text(v)) fn(c - COL_WEEK_FIRST + 1, v)
      }
    }

    if (isDoneLabel(label)) {
      if (!lastItem) {
        issues.push(`Row ${r + 1} (“${label}”) for ${current.display_name}: done row with no line above it, skipped.`)
        continue
      }
      lastItem.has_done = true
      lastItem.done_label = label
      weekCells((week, v) => {
        const raw = typeof v === 'number' ? String(v) : text(v)
        const { value, initials } = splitValueAndInitials(raw)
        if (!value) {
          issues.push(`Row ${r + 1}, week ${week} (${current!.display_name}): could not read “${raw}”.`)
          return
        }
        lastItem!.results[String(week)] = { value, initials }
      })
      continue
    }

    const line: ImportLine = { label, type: inferLineType(label), has_done: false, done_label: null, targets: {}, results: {} }
    weekCells((week, v) => {
      line.targets[String(week)] = typeof v === 'number' ? String(v) : text(v)
    })
    current.lines.push(line)
    lastItem = line
  }

  // A week marked Absent (with no other result) is an absent week.
  for (const s of students) {
    const done = s.lines.filter((l) => l.has_done)
    for (let w = 1; w <= Math.max(dates.length, 10); w++) {
      if (isAbsentWeek(done.map((l) => l.results[String(w)]?.value))) s.absent_weeks.push(w)
    }
    if (s.lines.length === 0) issues.push(`${s.display_name} (${s.code}): no lines found under their name.`)
  }

  const codes = new Set<string>()
  for (const s of students) {
    if (codes.has(s.code)) issues.push(`Student ID ${s.code} appears twice; the second one will overwrite the first.`)
    codes.add(s.code)
  }

  const pairs = parsePartners(wb, XLSX.utils.sheet_to_json, students, issues)

  students.sort((a, b) => compareNames(a.display_name, b.display_name))
  const lines = students.flatMap((s) => s.lines)
  return {
    dates,
    students,
    pairs,
    issues,
    counts: {
      students: students.length,
      lines: lines.length,
      targets: lines.reduce((n, l) => n + Object.keys(l.targets).length, 0),
      results: lines.reduce((n, l) => n + Object.keys(l.results).length, 0),
      notes: students.reduce((n, s) => n + s.notes.length, 0),
      pairs: pairs.length,
    },
  }
}

/** Revision Partners tab: Pair, Student, Revising this round, Partner, Revising this round. */
function parsePartners(
  wb: WorkBook,
  toJson: (ws: WorkSheet, opts: { header: 1; raw: true; defval: null }) => Cell[][],
  students: ImportStudent[],
  issues: string[],
): ImportPreview['pairs'] {
  const ws = findSheet(wb, /partner/i)
  if (!ws) return []
  const rows = toJson(ws, { header: 1, raw: true, defval: null })
  const headerIdx = rows.findIndex((r) => r.some((c) => /^pair$/i.test(text(c))))
  if (headerIdx < 0) {
    issues.push('Revision Partners tab found, but no “Pair” header row.')
    return []
  }
  const header = rows[headerIdx].map((c) => text(c).toLowerCase())
  const pairCol = header.findIndex((h) => h === 'pair')
  const studentCol = header.findIndex((h) => h === 'student')
  const partnerCol = header.findIndex((h) => h === 'partner')
  const revCols = header.map((h, i) => (h.startsWith('revising') ? i : -1)).filter((i) => i >= 0)

  const byName = new Map(students.map((s) => [s.display_name.trim().toLowerCase(), s.code]))
  const pairs = new Map<number, Map<string, string | null>>()

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const n = num(row[pairCol])
    if (n === null) continue
    const members = pairs.get(n) ?? new Map<string, string | null>()
    const add = (nameCell: Cell | undefined, revCell: Cell | undefined) => {
      const name = text(nameCell)
      if (!name) return
      const code = byName.get(name.toLowerCase())
      if (!code) {
        issues.push(`Revision Partners row ${r + 1}: “${name}” doesn't match a student on the Overview.`)
        return
      }
      if (!members.has(code)) members.set(code, text(revCell) || null)
    }
    add(row[studentCol], row[revCols[0]])
    if (partnerCol >= 0) add(row[partnerCol], row[revCols[1]])
    pairs.set(n, members)
  }

  return [...pairs.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pair_number, m]) => ({ pair_number, members: [...m.entries()].map(([code, revising]) => ({ code, revising })) }))
}
