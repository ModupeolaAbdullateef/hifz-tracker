/**
 * Turns a term payload from the database into per-student views, using the
 * rules in rules.ts. Also holds the small "patch" helpers that update a
 * payload in place after a save, so the screen updates instantly.
 */
import {
  compareNames,
  computeLine,
  computeStudent,
  exceptionWeekSet,
  isAbsentWeek,
  juzByWeek,
  type Line,
  type Result,
  type StudentTotals,
  type TargetText,
  type WeekCell,
} from './rules'
import type { Note, Pair, TermPayload, TermStudent } from './types'

export interface StudentView {
  student: TermStudent
  lines: Line[]
  cells: Map<string, WeekCell[]>
  totals: StudentTotals
  absentWeeks: Set<number>
  exceptionWeeks: Set<number>
  juz: Map<number, number | null>
  partners: string[]
  pair: Pair | null
  notes: Note[]
  selfChecked: Set<string>
}

export interface TermView {
  payload: TermPayload
  students: StudentView[]
  byId: Map<string, StudentView>
}

export const selfCheckKey = (lineId: string, week: number) => `${lineId}:${week}`

export function buildTermView(payload: TermPayload, today: string): TermView {
  const linesByStudent = groupBy(payload.lines, (l) => l.student_id)
  const targetsByLine = new Map<string, Map<number, TargetText>>()
  for (const t of payload.targets) {
    if (!targetsByLine.has(t.line_id)) targetsByLine.set(t.line_id, new Map())
    targetsByLine.get(t.line_id)!.set(t.week, { plan: t.plan, override: t.override })
  }
  const resultsByLine = new Map<string, Map<number, Result>>()
  for (const r of payload.results) {
    if (!resultsByLine.has(r.line_id)) resultsByLine.set(r.line_id, new Map())
    resultsByLine.get(r.line_id)!.set(r.week, r)
  }
  const absentByStudent = new Map<string, Set<number>>()
  for (const a of payload.attendance) {
    if (!a.absent) continue
    if (!absentByStudent.has(a.student_id)) absentByStudent.set(a.student_id, new Set())
    absentByStudent.get(a.student_id)!.add(a.week)
  }
  const selfChecked = new Set(payload.selfchecks.map((c) => selfCheckKey(c.line_id, c.week)))
  const notesByStudent = groupBy(payload.notes, (n) => n.student_id)

  const students = payload.students.map((student) => {
    const lines = [...(linesByStudent.get(student.id) ?? [])].sort((a, b) => a.sort_order - b.sort_order)
    const absentWeeks = new Set(absentByStudent.get(student.id) ?? [])
    // A week marked Absent on the done boxes (and nothing else) also counts, e.g. imported sheets.
    const doneLines = lines.filter((l) => l.has_done)
    for (const w of payload.weeks) {
      if (isAbsentWeek(doneLines.map((l) => resultsByLine.get(l.id)?.get(w.week_number)?.value))) absentWeeks.add(w.week_number)
    }
    const exceptionWeeks = exceptionWeekSet(payload.weeks, student.exception_from, student.exception_until)
    const cells = new Map<string, WeekCell[]>()
    for (const line of lines) {
      cells.set(
        line.id,
        computeLine({
          line,
          weeks: payload.weeks,
          targets: targetsByLine.get(line.id) ?? new Map(),
          results: resultsByLine.get(line.id) ?? new Map(),
          absentWeeks,
          exceptionWeeks,
          today,
        }),
      )
    }
    const totals = computeStudent({
      weeks: payload.weeks,
      lines,
      cellsByLine: cells,
      absentWeeks,
      exceptionWeeks,
      pagesBefore: Number(student.pages_before ?? 0),
      projectedOverride: student.projected_override === null ? null : Number(student.projected_override),
      today,
    })
    const juzLine = lines.find((l) => l.type === 'juz')
    const juz = juzByWeek(payload.weeks, juzLine ? targetsByLine.get(juzLine.id) ?? new Map() : new Map())
    const pair =
      payload.pairs.find((p) => p.members.some((m) => m.student_id === student.id || (m.is_me && payload.students.length === 1))) ??
      null
    const partners = pair
      ? pair.members.filter((m) => m.student_id !== student.id && !m.is_me).map((m) => m.display_name)
      : []
    return {
      student,
      lines,
      cells,
      totals,
      absentWeeks,
      exceptionWeeks,
      juz,
      partners,
      pair,
      notes: notesByStudent.get(student.id) ?? [],
      selfChecked,
    }
  })

  students.sort((a, b) => compareNames(a.student.display_name, b.student.display_name))
  return { payload, students, byId: new Map(students.map((s) => [s.student.id, s])) }
}

function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!out.has(k)) out.set(k, [])
    out.get(k)!.push(item)
  }
  return out
}

// ---------------------------------------------------------------------------
// Local patches (applied straight after a save so the screen never waits)
// ---------------------------------------------------------------------------

export function patchResult(
  p: TermPayload,
  lineId: string,
  week: number,
  value: string,
  initials: string | null,
  note: string | null,
  by: string,
): TermPayload {
  const results = p.results.filter((r) => !(r.line_id === lineId && r.week === week))
  if (value.trim()) {
    results.push({ line_id: lineId, week, value, initials, note, updated_by: by, updated_at: new Date().toISOString() })
  }
  return { ...p, results }
}

export function patchAbsent(
  p: TermPayload,
  studentId: string,
  week: number,
  absent: boolean,
  initials: string | null,
  by: string,
): TermPayload {
  const attendance = p.attendance.filter((a) => !(a.student_id === studentId && a.week === week))
  const lineIds = new Set(p.lines.filter((l) => l.student_id === studentId && l.has_done).map((l) => l.id))
  let results = p.results
  if (absent) {
    attendance.push({ student_id: studentId, week, absent: true, initials })
    results = results.filter((r) => !(lineIds.has(r.line_id) && r.week === week))
    for (const id of lineIds) {
      results.push({ line_id: id, week, value: 'Absent', initials, note: null, updated_by: by, updated_at: new Date().toISOString() })
    }
  } else {
    results = results.filter((r) => !(lineIds.has(r.line_id) && r.week === week && /^absent$/i.test(r.value)))
  }
  return { ...p, attendance, results }
}

export function patchTargets(
  p: TermPayload,
  lineId: string,
  field: 'plan' | 'override',
  items: { week: number; text: string | null }[],
): TermPayload {
  const targets = [...p.targets]
  for (const { week, text } of items) {
    const idx = targets.findIndex((t) => t.line_id === lineId && t.week === week)
    const value = text && text.trim() ? text.trim() : null
    if (idx >= 0) {
      const next = { ...targets[idx], [field]: value }
      if (!next.plan && !next.override) targets.splice(idx, 1)
      else targets[idx] = next
    } else if (value) {
      targets.push({ line_id: lineId, week, plan: field === 'plan' ? value : null, override: field === 'override' ? value : null })
    }
  }
  return { ...p, targets }
}

/** Lines in a sensible display order with the done row under each item line. */
export function lineDisplayName(line: Line): string {
  return line.label
}

export function doneRowLabel(line: Line): string {
  return line.done_label || `${line.label} done`
}
