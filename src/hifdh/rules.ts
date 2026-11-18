/**
 * Hifdh Portal business rules (section 7 of the developer brief).
 *
 * Everything here is pure: given a term's weeks, a student's lines, the typed
 * targets and the recorded results, it works out the due target for every
 * week (with carry-over), the colours, totals, status and attendance. The
 * Overview, the recording screen, the student view and the exports all use
 * these functions, so the rules live in exactly one place. See rules.test.ts.
 */

export type LineType =
  | 'new_hifdh'
  | 'planned_pages'
  | 'juz'
  | 'prev5'
  | 'revision'
  | 'half_revision'
  | 'juz_tests'
  | 'custom'

export const LINE_TYPE_LABELS: Record<LineType, string> = {
  new_hifdh: 'New Hifdh',
  planned_pages: 'Planned pages',
  juz: 'Juz',
  prev5: '5 previous pages',
  revision: 'Revision',
  half_revision: 'Previous Half / Old Half revision',
  juz_tests: 'Juz tests',
  custom: 'Custom',
}

export interface Week {
  week_number: number
  class_date: string // YYYY-MM-DD
  cancelled: boolean
}

export interface Line {
  id: string
  student_id: string
  label: string
  type: LineType
  sort_order: number
  has_done: boolean
  done_label: string | null
}

export interface TargetText {
  plan: string | null
  override: string | null
}

export interface Result {
  line_id: string
  week: number
  value: string
  initials: string | null
  note: string | null
  updated_by?: string | null
  updated_at?: string | null
}

export type DoneKind = 'Y' | 'N' | 'part' | 'absent' | 'pass' | 'fail' | 'empty'

export type CellColour =
  | 'none'
  | 'green'
  | 'amber'
  | 'red'
  | 'test-due'
  | 'test-pass'
  | 'test-fail'
  /** The carry-over suggestion on revision lines ("Revise this week"). */
  | 'gold'

export interface WeekCell {
  week: number
  classDate: string
  cancelled: boolean
  passed: boolean
  /** What the term plan says for this week. */
  plan: string | null
  /** The carry-over suggestion ("Revise this week") for shifting lines. */
  suggestion: string | null
  /** The target actually due this week (a typed override wins over the suggestion). */
  target: string | null
  overridden: boolean
  /** True for the week straight after a missed week (shown amber with "Plan: …"). */
  carried: boolean
  isTest: boolean
  result: Result | null
  kind: DoneKind
  missed: boolean
  /** Colour of the done box. */
  colour: CellColour
  /** Colour of the target box. */
  targetColour: CellColour
}

// ---------------------------------------------------------------------------
// Dates and weeks
// ---------------------------------------------------------------------------

/** 7.1: a week counts as passed from the day after its class date. */
export function isWeekPassed(week: Week, today: string): boolean {
  return today > week.class_date
}

/** The week to open by default: today's class, else the most recent one, else week 1. */
export function currentWeekNumber(weeks: Week[], today: string): number {
  if (weeks.length === 0) return 1
  let current = weeks[0].week_number
  for (const w of weeks) if (w.class_date <= today) current = w.week_number
  return current
}

// ---------------------------------------------------------------------------
// Parsing targets and results
// ---------------------------------------------------------------------------

export function isTestText(text: string | null | undefined): boolean {
  return !!text && /\btest\b/i.test(text)
}

/** "2.5", "3 pages", "1p" -> number. Anything else -> null. */
export function parsePages(text: string | null | undefined): number | null {
  if (!text) return null
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:pages?|pgs?|p)?\s*$/i.exec(text)
  return m ? Number(m[1]) : null
}

const FRACTION_UNITS: Record<string, number> = { '1/4': 1, '1/2': 2, '3/4': 3 }

/**
 * Revision portion size in units: 1/4 = 1, 1/2 = 2, 3/4 = 3, whole juz = 4.
 * "30 2nd 1/4" -> 1, "1 2nd 1/2" -> 2, "Juz 29" or "29" -> 4. Unknown -> null.
 */
export function portionUnits(text: string | null | undefined): number | null {
  if (!text) return null
  const portion = /^\s*(\d{1,2})\s+(1st|2nd|3rd|4th)\s+(1\/4|1\/2|3\/4)\s*$/i.exec(text)
  if (portion) return FRACTION_UNITS[portion[3]]
  if (/^\s*(?:juz\s*)?\d{1,2}\s*$/i.test(text)) return 4
  return null
}

/** Drop-down options for revision portions, as offered by the Excel sheet. */
export function revisionPortionOptions(): string[] {
  const out: string[] = []
  const nth = ['1st', '2nd', '3rd', '4th']
  for (let juz = 30; juz >= 1; juz--) {
    for (let i = 0; i < 4; i++) out.push(`${juz} ${nth[i]} 1/4`)
    for (let i = 0; i < 2; i++) out.push(`${juz} ${nth[i]} 1/2`)
    for (let i = 0; i < 2; i++) out.push(`${juz} ${nth[i]} 3/4`)
    out.push(`Juz ${juz}`)
  }
  return out
}

/** Classifies a done value: "Y", "N", "1.5", "Absent", "Pass", "Fail", "Redo", or blank. */
export function classifyResult(value: string | null | undefined): DoneKind {
  const v = (value ?? '').trim().toLowerCase()
  if (!v) return 'empty'
  if (v === 'y' || v === 'yes') return 'Y'
  if (v === 'n' || v === 'no') return 'N'
  if (v === 'absent' || v === 'a' || v === 'abs') return 'absent'
  if (v === 'pass' || v === 'passed') return 'pass'
  if (v === 'fail' || v === 'failed' || v === 'redo') return 'fail'
  if (/^\d+(\.\d+)?$/.test(v)) return 'part'
  return 'empty'
}

/**
 * 7.7: splits a typed cell such as "Y MMA", "1.5 AB" or "Juz 29 Test Pass AB"
 * into the done value and the tester's initials.
 */
export function splitValueAndInitials(raw: string): { value: string; initials: string | null } {
  const text = raw.trim().replace(/\s+/g, ' ')
  const m = /^(.*?\b(?:y|n|yes|no|absent|pass|passed|fail|failed|redo|\d+(?:\.\d+)?))\s+([A-Za-z]{2,4})$/i.exec(text)
  if (m && classifyResult(lastWord(m[1])) !== 'empty') {
    return { value: normaliseValue(lastWord(m[1])), initials: m[2].toUpperCase() }
  }
  return { value: normaliseValue(lastWord(text)), initials: null }
}

function lastWord(s: string): string {
  const parts = s.trim().split(' ')
  return parts[parts.length - 1] ?? ''
}

/** Canonical spelling for storing a done value. */
export function normaliseValue(value: string): string {
  const kind = classifyResult(value)
  switch (kind) {
    case 'Y':
      return 'Y'
    case 'N':
      return 'N'
    case 'absent':
      return 'Absent'
    case 'pass':
      return 'Pass'
    case 'fail':
      return /redo/i.test(value) ? 'Redo' : 'Fail'
    case 'part':
      return String(Number(value))
    default:
      return ''
  }
}

// ---------------------------------------------------------------------------
// Line classification
// ---------------------------------------------------------------------------

/** 7.2: a line is revision if its label starts with "Revision" or its done row is "Revision done". */
export function isRevisionLine(line: Pick<Line, 'label' | 'type' | 'done_label'>): boolean {
  if (line.type === 'revision' || line.type === 'half_revision') return true
  if (/^\s*revision/i.test(line.label)) return true
  return (line.done_label ?? '').trim().toLowerCase() === 'revision done'
}

/** Lines whose plan never shifts: New Hifdh pages, lines with no done row, and the juz line. */
function isFixedLine(line: Line): boolean {
  return line.type === 'new_hifdh' || line.type === 'juz' || !line.has_done
}

// ---------------------------------------------------------------------------
// 7.2 / 7.3 / 7.4: the per-line engine
// ---------------------------------------------------------------------------

export interface LineInput {
  line: Line
  weeks: Week[]
  targets: Map<number, TargetText>
  results: Map<number, Result>
  /** Weeks the student was marked absent (student-level). */
  absentWeeks: Set<number>
  /** Weeks inside the student's absence exception period (absent shows green). */
  exceptionWeeks?: Set<number>
  today: string
}

function isMissed(isRev: boolean, weekNumber: number, passed: boolean, kind: DoneKind, absent: boolean): boolean {
  if (isRev) {
    // Revision: N or Absent counts straight away, in any week.
    return kind === 'N' || absent || (passed && kind === 'empty')
  }
  // Other lines: empty or Absent once the week has passed; N from week 3 onwards straight away.
  return (passed && (kind === 'empty' || absent)) || (kind === 'N' && weekNumber >= 3)
}

function doneColour(kind: DoneKind, inException: boolean): CellColour {
  switch (kind) {
    case 'Y':
    case 'pass':
      return 'green'
    case 'part':
      return 'amber'
    case 'N':
    case 'fail':
      return 'red'
    case 'absent':
      return inException ? 'green' : 'red'
    default:
      return 'none'
  }
}

function testColour(kind: DoneKind): CellColour {
  if (kind === 'pass') return 'test-pass'
  if (kind === 'fail') return 'test-fail'
  return 'test-due'
}

export function computeLine(input: LineInput): WeekCell[] {
  const { line, today } = input
  const weeks = [...input.weeks].sort((a, b) => a.week_number - b.week_number)
  const isRev = isRevisionLine(line)
  const fixed = isFixedLine(line)

  // The shifting plan: every non-blank, non-test planned target, in week order.
  // A cancelled week's target is kept, so it moves on to the next class.
  const queue: string[] = []
  for (const w of weeks) {
    const plan = input.targets.get(w.week_number)?.plan?.trim()
    if (plan && !isTestText(plan)) queue.push(plan)
  }

  let p = 0
  let prevMissed = false
  const cells: WeekCell[] = []

  for (const w of weeks) {
    const t = input.targets.get(w.week_number)
    const plan = t?.plan?.trim() || null
    const override = t?.override?.trim() || null
    const result = input.results.get(w.week_number) ?? null
    const kind = classifyResult(result?.value)
    const passed = isWeekPassed(w, today)
    const absent = input.absentWeeks.has(w.week_number) || kind === 'absent'
    const effectiveKind: DoneKind = absent && kind === 'empty' ? 'absent' : kind
    const inException = input.exceptionWeeks?.has(w.week_number) ?? false

    const base = {
      week: w.week_number,
      classDate: w.class_date,
      cancelled: w.cancelled,
      passed,
      plan,
      result,
      kind: effectiveKind,
    }

    if (w.cancelled) {
      cells.push({
        ...base,
        suggestion: null,
        target: null,
        overridden: false,
        carried: false,
        isTest: false,
        missed: false,
        colour: 'none',
        targetColour: 'none',
      })
      continue
    }

    // Fixed lines, tests and blank plan weeks never shift (a typed override still shows).
    if (fixed || !line.has_done || (plan && isTestText(plan)) || (!plan && !override && p >= queue.length)) {
      const target = override ?? plan
      const isTest = isTestText(target)
      const missed = !fixed && !isTest && !!target && isMissed(isRev, w.week_number, passed, effectiveKind, absent)
      cells.push({
        ...base,
        suggestion: null,
        target,
        overridden: !!override,
        carried: false,
        isTest,
        missed,
        colour: isTest ? testColour(effectiveKind) : doneColour(effectiveKind, inException),
        targetColour: isTest ? testColour(effectiveKind) : 'none',
      })
      continue
    }

    if (!plan && !override) {
      // A blank plan week inside the plan stays blank and does not consume the queue.
      cells.push({
        ...base,
        suggestion: null,
        target: null,
        overridden: false,
        carried: false,
        isTest: false,
        missed: false,
        colour: doneColour(effectiveKind, inException),
        targetColour: 'none',
      })
      continue
    }

    const suggestion = queue[p] ?? null
    const target = override ?? suggestion
    const isTest = isTestText(target)
    const missed = !!target && !isTest && isMissed(isRev, w.week_number, passed, effectiveKind, absent)
    const carried = prevMissed

    if (target && !isTest) {
      if (missed) {
        // The due item stays at the front of the queue and repeats next week.
      } else {
        let advance = 1
        // 7.3: a larger typed portion that was done moves the line on by the extra amount.
        if (override && effectiveKind === 'Y') {
          const typed = portionUnits(override)
          const suggested = portionUnits(suggestion)
          if (typed && suggested) advance += Math.max(0, Math.floor(typed / suggested) - 1)
        }
        p += advance
      }
    }
    prevMissed = missed

    cells.push({
      ...base,
      suggestion: isRev ? suggestion : null,
      target,
      overridden: !!override,
      carried,
      isTest,
      missed,
      colour: isTest ? testColour(effectiveKind) : doneColour(effectiveKind, inException),
      targetColour: isTest ? testColour(effectiveKind) : carried ? 'amber' : isRev && !override ? 'gold' : 'none',
    })
  }

  return cells
}

// ---------------------------------------------------------------------------
// T5: current juz, filled forward from the week it changes
// ---------------------------------------------------------------------------

export function parseJuz(text: string | null | undefined): number | null {
  if (!text || isTestText(text)) return null
  const m = /^\s*(?:juz\s*)?(\d{1,2})\s*$/i.exec(text)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 30 ? n : null
}

/** Juz for every week, carrying the last entered juz forward. */
export function juzByWeek(weeks: Week[], targets: Map<number, TargetText>): Map<number, number | null> {
  const out = new Map<number, number | null>()
  let current: number | null = null
  for (const w of [...weeks].sort((a, b) => a.week_number - b.week_number)) {
    const t = targets.get(w.week_number)
    const juz = parseJuz(t?.override) ?? parseJuz(t?.plan)
    if (juz !== null) current = juz
    out.set(w.week_number, current)
  }
  return out
}

/** "Juz 29 Test" -> 29, "5 Juz Test" -> null (not a single juz). */
export function testJuz(text: string | null | undefined): number | null {
  if (!text) return null
  const m = /juz\s*(\d{1,2})\s*test/i.exec(text)
  return m ? Number(m[1]) : null
}

// ---------------------------------------------------------------------------
// 7.5: totals, status and attendance for one student
// ---------------------------------------------------------------------------

export interface StudentInput {
  weeks: Week[]
  lines: Line[]
  cellsByLine: Map<string, WeekCell[]>
  absentWeeks: Set<number>
  exceptionWeeks?: Set<number>
  pagesBefore: number
  projectedOverride: number | null
  today: string
}

export interface StudentTotals {
  pagesDone: number
  totalMemorised: number
  expectedByNow: number
  totalProjected: number
  status: 'On track' | 'Behind' | null
  weeksAbsent: number
  classesPassed: number
  classesAttended: number
  attendancePct: number | null
  attendanceLow: boolean
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeStudent(input: StudentInput): StudentTotals {
  const { weeks, lines, cellsByLine, today } = input
  const newHifdhLines = lines.filter((l) => l.type === 'new_hifdh')
  const plannedLines = lines.filter((l) => l.type === 'planned_pages')

  // Pages done this term: Y counts the week's target pages, a number counts as part done.
  let pagesDone = 0
  let trackedInJuz = false
  for (const line of newHifdhLines) {
    for (const cell of cellsByLine.get(line.id) ?? []) {
      if (cell.plan && !cell.isTest && parsePages(cell.plan) === null) trackedInJuz = true
      if (cell.kind === 'Y') pagesDone += parsePages(cell.target) ?? 0
      else if (cell.kind === 'part') pagesDone += Number(cell.result?.value ?? 0)
    }
  }

  // Planned pages per week: the Planned pages line, else the New Hifdh plan.
  const planSource = plannedLines.length > 0 ? plannedLines : newHifdhLines
  const plannedByWeek = new Map<number, number>()
  for (const line of planSource) {
    for (const cell of cellsByLine.get(line.id) ?? []) {
      const pages = parsePages(cell.plan)
      if (pages !== null) plannedByWeek.set(cell.week, (plannedByWeek.get(cell.week) ?? 0) + pages)
    }
  }

  // Weeks with a juz test on any line are ignored in Expected by now.
  const testWeeks = new Set<number>()
  for (const cells of cellsByLine.values()) for (const c of cells) if (c.isTest) testWeeks.add(c.week)

  let expected = 0
  let projected = 0
  for (const w of weeks) {
    if (w.cancelled) continue
    const planned = plannedByWeek.get(w.week_number) ?? 0
    projected += planned
    if (isWeekPassed(w, today) && w.class_date <= today && !testWeeks.has(w.week_number)) expected += planned
  }

  const passedWeeks = weeks.filter((w) => !w.cancelled && isWeekPassed(w, today))
  const absentPassed = passedWeeks.filter((w) => input.absentWeeks.has(w.week_number))
  const excused = absentPassed.filter((w) => input.exceptionWeeks?.has(w.week_number)).length
  const weeksAbsent = absentPassed.length
  const classesAttended = passedWeeks.length - weeksAbsent + excused
  const attendancePct = passedWeeks.length ? Math.round((classesAttended / passedWeeks.length) * 100) : null

  const totalMemorised = round2(input.pagesBefore + pagesDone)
  const expectedByNow = round2(input.pagesBefore + expected)

  return {
    pagesDone: round2(pagesDone),
    totalMemorised,
    expectedByNow,
    totalProjected: input.projectedOverride ?? round2(input.pagesBefore + projected),
    status: trackedInJuz || newHifdhLines.length === 0 ? null : totalMemorised + 1e-9 >= expectedByNow ? 'On track' : 'Behind',
    weeksAbsent,
    classesPassed: passedWeeks.length,
    classesAttended,
    attendancePct,
    attendanceLow: attendancePct !== null && attendancePct < 90,
  }
}

// ---------------------------------------------------------------------------
// 7.8: ordering
// ---------------------------------------------------------------------------

const TITLE_RE = /^(?:dr|md|hafidh|hafiz|sh|shaykh|sheikh)\.?\s+/i

/** Sort key: first name, ignoring leading titles such as Dr., Md., Hafidh, Sh. */
export function nameSortKey(name: string): string {
  let n = name.trim()
  while (TITLE_RE.test(n)) n = n.replace(TITLE_RE, '')
  return n.toLowerCase()
}

export function compareNames(a: string, b: string): number {
  return nameSortKey(a).localeCompare(nameSortKey(b), 'en-GB')
}

// ---------------------------------------------------------------------------
// Absent weeks
// ---------------------------------------------------------------------------

/**
 * A week counts as absent when at least one done box says Absent and no box
 * has a real result (Y, N, a number, Pass, Fail). Lines left empty that week,
 * such as a Juz tests line with no test, don't stop it counting.
 */
export function isAbsentWeek(values: (string | null | undefined)[]): boolean {
  const kinds = values.map(classifyResult).filter((k) => k !== 'empty')
  return kinds.length > 0 && kinds.every((k) => k === 'absent')
}

// ---------------------------------------------------------------------------
// Absence exception periods
// ---------------------------------------------------------------------------

export function exceptionWeekSet(weeks: Week[], from: string | null, until: string | null): Set<number> {
  const out = new Set<number>()
  if (!until) return out
  for (const w of weeks) {
    if ((!from || w.class_date >= from) && w.class_date <= until) out.add(w.week_number)
  }
  return out
}
