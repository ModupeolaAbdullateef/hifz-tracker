import { describe, expect, it } from 'vitest'
import {
  classifyResult,
  compareNames,
  computeLine,
  computeStudent,
  currentWeekNumber,
  exceptionWeekSet,
  isAbsentWeek,
  isRevisionLine,
  isWeekPassed,
  juzByWeek,
  nameSortKey,
  portionUnits,
  splitValueAndInitials,
  testJuz,
  type Line,
  type LineType,
  type Result,
  type TargetText,
  type Week,
} from './rules'

// A 10-week term starting Thursday 15 October 2026.
const WEEKS: Week[] = Array.from({ length: 10 }, (_, i) => {
  const d = new Date(Date.UTC(2026, 9, 15 + i * 7))
  return { week_number: i + 1, class_date: d.toISOString().slice(0, 10), cancelled: false }
})
const dateOf = (week: number) => WEEKS[week - 1].class_date
const dayAfter = (week: number) => {
  const d = new Date(dateOf(week) + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

function line(type: LineType, label = '', extra: Partial<Line> = {}): Line {
  return { id: 'L1', student_id: 'S1', label: label || type, type, sort_order: 1, has_done: true, done_label: null, ...extra }
}

function plans(...texts: (string | null)[]): Map<number, TargetText> {
  const m = new Map<number, TargetText>()
  texts.forEach((t, i) => m.set(i + 1, { plan: t, override: null }))
  return m
}

function results(entries: Record<number, string>): Map<number, Result> {
  const m = new Map<number, Result>()
  for (const [w, v] of Object.entries(entries)) {
    m.set(Number(w), { line_id: 'L1', week: Number(w), value: v, initials: 'MMA', note: null })
  }
  return m
}

const run = (
  l: Line,
  targets: Map<number, TargetText>,
  res: Record<number, string>,
  today: string,
  absent: number[] = [],
  weeks: Week[] = WEEKS,
) => computeLine({ line: l, weeks, targets, results: results(res), absentWeeks: new Set(absent), today })

const REV_PLAN = plans('30 1st 1/4', '30 2nd 1/4', '30 3rd 1/4', '30 4th 1/4', '29 1st 1/4')

describe('7.1 week passed', () => {
  it('is not passed on the class date itself, only from the day after', () => {
    expect(isWeekPassed(WEEKS[0], dateOf(1))).toBe(false)
    expect(isWeekPassed(WEEKS[0], dayAfter(1))).toBe(true)
  })

  it('opens today’s week by default', () => {
    expect(currentWeekNumber(WEEKS, '2026-10-01')).toBe(1)
    expect(currentWeekNumber(WEEKS, dateOf(3))).toBe(3)
    expect(currentWeekNumber(WEEKS, dayAfter(3))).toBe(3)
  })
})

describe('7.2 carry-over on revision lines', () => {
  const rev = line('revision', 'Revision')

  it('N on revision in week 1 moves the plan on straight away, before the week has passed', () => {
    const cells = run(rev, REV_PLAN, { 1: 'N' }, dateOf(1))
    expect(cells[0].missed).toBe(true)
    expect(cells[1].target).toBe('30 1st 1/4')
    expect(cells[1].carried).toBe(true)
    expect(cells[1].targetColour).toBe('amber')
    expect(cells[1].plan).toBe('30 2nd 1/4')
    expect(cells[2].target).toBe('30 2nd 1/4')
    expect(cells[2].carried).toBe(false)
  })

  it('Absent on revision carries straight away', () => {
    const cells = run(rev, REV_PLAN, {}, dateOf(1), [1])
    expect(cells[0].missed).toBe(true)
    expect(cells[1].target).toBe('30 1st 1/4')
  })

  it('an empty revision box only carries once the week has passed', () => {
    expect(run(rev, REV_PLAN, {}, dateOf(1))[1].target).toBe('30 2nd 1/4')
    expect(run(rev, REV_PLAN, {}, dayAfter(1))[1].target).toBe('30 1st 1/4')
  })

  it('never doubles up targets after two misses in a row', () => {
    const cells = run(rev, REV_PLAN, { 1: 'N', 2: 'N' }, dateOf(2))
    expect(cells.map((c) => c.target).slice(0, 4)).toEqual(['30 1st 1/4', '30 1st 1/4', '30 1st 1/4', '30 2nd 1/4'])
  })

  it('Y and part done both move the line on', () => {
    const cells = run(rev, REV_PLAN, { 1: 'Y', 2: '0.5' }, dayAfter(2))
    expect(cells[2].target).toBe('30 3rd 1/4')
  })

  it('treats a line as revision from its label or its done row', () => {
    expect(isRevisionLine({ label: 'Revision', type: 'custom', done_label: null })).toBe(true)
    expect(isRevisionLine({ label: 'Previous Half', type: 'custom', done_label: 'Revision done' })).toBe(true)
    expect(isRevisionLine({ label: 'Old Half', type: 'custom', done_label: 'Old Half done' })).toBe(false)
  })

  it('shows the suggestion in gold when no target has been typed over it', () => {
    const cells = run(rev, REV_PLAN, {}, dateOf(1))
    expect(cells[0].suggestion).toBe('30 1st 1/4')
    expect(cells[0].targetColour).toBe('gold')
  })
})

describe('7.2 carry-over on other lines', () => {
  const planned = line('planned_pages', 'Planned pages')
  const pagePlan = plans('2', '2.5', '3', '3.5', '4')

  it('N in week 2 does not move a non-revision line', () => {
    const cells = run(planned, pagePlan, { 1: 'Y', 2: 'N' }, dateOf(2))
    expect(cells[1].missed).toBe(false)
    expect(cells[2].target).toBe('3')
  })

  it('N in week 3 moves a non-revision line straight away', () => {
    const cells = run(planned, pagePlan, { 1: 'Y', 2: 'Y', 3: 'N' }, dateOf(3))
    expect(cells[2].missed).toBe(true)
    expect(cells[3].target).toBe('3')
    expect(cells[3].carried).toBe(true)
    expect(cells[4].target).toBe('3.5')
  })

  it('an empty box on a non-revision line carries once the week has passed', () => {
    const cells = run(planned, pagePlan, { 1: 'Y' }, dayAfter(2))
    expect(cells[1].missed).toBe(true)
    expect(cells[2].target).toBe('2.5')
  })

  it('Absent carries a non-revision line once the week has passed', () => {
    expect(run(planned, pagePlan, {}, dateOf(1), [1])[1].target).toBe('2.5')
    expect(run(planned, pagePlan, {}, dayAfter(1), [1])[1].target).toBe('2')
  })

  it('New Hifdh pages never move', () => {
    const cells = run(line('new_hifdh', 'New Hifdh'), pagePlan, { 1: 'N', 2: 'N', 3: 'N' }, dayAfter(4), [4])
    expect(cells.map((c) => c.target).slice(0, 5)).toEqual(['2', '2.5', '3', '3.5', '4'])
    expect(cells.every((c) => !c.carried)).toBe(true)
  })

  it('tests and blank plan weeks are fixed and do not shift', () => {
    const t = plans('A', 'B', 'Juz 29 Test', null, 'C', 'D')
    const cells = run(line('prev5', '5 previous pages'), t, { 1: 'Y', 2: 'N', 3: '', 4: '' }, dateOf(3), [2])
    // Week 2 absent (passed) -> B carries; the test (week 3) and blank (week 4) stay put.
    expect(cells[2].target).toBe('Juz 29 Test')
    expect(cells[2].isTest).toBe(true)
    expect(cells[3].target).toBeNull()
    expect(cells[4].target).toBe('B')
  })

  it('cancelled weeks show no class and their target moves on to the next class', () => {
    const weeks = WEEKS.map((w) => (w.week_number === 2 ? { ...w, cancelled: true } : w))
    const cells = run(planned, pagePlan, { 1: 'Y' }, dateOf(3), [], weeks)
    expect(cells[1].cancelled).toBe(true)
    expect(cells[1].target).toBeNull()
    expect(cells[2].target).toBe('2.5')
  })
})

describe('7.3 typed-over suggestions', () => {
  const rev = line('revision', 'Revision')

  it('a typed target replaces the suggestion for that week', () => {
    const t = new Map(REV_PLAN)
    t.set(1, { plan: '30 1st 1/4', override: '28 1st 1/4' })
    const cells = run(rev, t, {}, dateOf(1))
    expect(cells[0].target).toBe('28 1st 1/4')
    expect(cells[0].suggestion).toBe('30 1st 1/4')
    expect(cells[0].overridden).toBe(true)
  })

  it('a larger typed portion that was done moves the line on by the extra amount', () => {
    // Suggested 1/4 (1 unit), typed 1/2 (2 units), done Y -> extra = floor(2/1) - 1 = 1.
    const t = new Map(REV_PLAN)
    t.set(1, { plan: '30 1st 1/4', override: '30 1st 1/2' })
    const cells = run(rev, t, { 1: 'Y' }, dayAfter(1))
    expect(cells[1].target).toBe('30 3rd 1/4')
  })

  it('a whole juz typed over a quarter moves on by three extra weeks', () => {
    const t = new Map(REV_PLAN)
    t.set(1, { plan: '30 1st 1/4', override: 'Juz 30' })
    const cells = run(rev, t, { 1: 'Y' }, dayAfter(1))
    expect(cells[1].target).toBe('29 1st 1/4')
  })

  it('a typed target that is not done is missed and the original due target carries', () => {
    const t = new Map(REV_PLAN)
    t.set(1, { plan: '30 1st 1/4', override: '30 1st 1/2' })
    const cells = run(rev, t, { 1: 'N' }, dateOf(1))
    expect(cells[1].target).toBe('30 1st 1/4')
    expect(cells[1].carried).toBe(true)
  })

  it('measures portion sizes in units', () => {
    expect(portionUnits('30 2nd 1/4')).toBe(1)
    expect(portionUnits('1 2nd 1/2')).toBe(2)
    expect(portionUnits('29 1st 3/4')).toBe(3)
    expect(portionUnits('Juz 29')).toBe(4)
    expect(portionUnits('2.5 pages')).toBeNull()
  })
})

describe('7.4 absent and exception periods', () => {
  it('absent marks every line missed and shows red, or green during an exception period', () => {
    const l = line('revision', 'Revision')
    const normal = run(l, REV_PLAN, {}, dateOf(1), [1])
    expect(normal[0].kind).toBe('absent')
    expect(normal[0].colour).toBe('red')
    const excused = computeLine({
      line: l,
      weeks: WEEKS,
      targets: REV_PLAN,
      results: new Map(),
      absentWeeks: new Set([1]),
      exceptionWeeks: new Set([1]),
      today: dateOf(1),
    })
    expect(excused[0].colour).toBe('green')
    expect(excused[0].missed).toBe(true)
  })

  it('counts a week as absent when it is marked Absent and has no other result', () => {
    expect(isAbsentWeek(['Absent', 'Absent', null])).toBe(true)
    expect(isAbsentWeek(['Absent', 'Y'])).toBe(false)
    expect(isAbsentWeek([null, ''])).toBe(false)
  })

  it('works out which weeks fall in an exception period', () => {
    expect([...exceptionWeekSet(WEEKS, dateOf(2), dateOf(3))]).toEqual([2, 3])
    expect([...exceptionWeekSet(WEEKS, null, dateOf(1))]).toEqual([1])
    expect(exceptionWeekSet(WEEKS, null, null).size).toBe(0)
  })
})

describe('7.5 totals, status and attendance', () => {
  const nh = { ...line('new_hifdh', 'New Hifdh'), id: 'NH' }
  const pp = { ...line('planned_pages', 'Planned pages'), id: 'PP', has_done: false }
  const tests = { ...line('juz_tests', 'Juz tests'), id: 'JT' }

  function student(
    nhPlan: (string | null)[],
    nhResults: Record<number, string>,
    ppPlan: (string | null)[],
    today: string,
    opts: { absent?: number[]; testWeeks?: number[]; exception?: number[]; before?: number; override?: number | null } = {},
  ) {
    const absent = new Set(opts.absent ?? [])
    const testPlan = plans(...WEEKS.map((w) => ((opts.testWeeks ?? []).includes(w.week_number) ? 'Juz 29 Test' : null)))
    const cellsByLine = new Map([
      [nh.id, computeLine({ line: nh, weeks: WEEKS, targets: plans(...nhPlan), results: results(nhResults), absentWeeks: absent, today })],
      [pp.id, computeLine({ line: pp, weeks: WEEKS, targets: plans(...ppPlan), results: new Map(), absentWeeks: absent, today })],
      [tests.id, computeLine({ line: tests, weeks: WEEKS, targets: testPlan, results: new Map(), absentWeeks: absent, today })],
    ])
    return computeStudent({
      weeks: WEEKS,
      lines: [nh, pp, tests],
      cellsByLine,
      absentWeeks: absent,
      exceptionWeeks: new Set(opts.exception ?? []),
      pagesBefore: opts.before ?? 100,
      projectedOverride: opts.override ?? null,
      today,
    })
  }

  const tenTwos = Array(10).fill('2')

  it('Total memorised = pages before term + pages done (Y counts the target, a number counts as part done)', () => {
    const t = student(tenTwos, { 1: 'Y', 2: '1.5', 3: 'N' }, tenTwos, dayAfter(3))
    expect(t.pagesDone).toBe(3.5)
    expect(t.totalMemorised).toBe(103.5)
  })

  it('Expected by now counts planned pages up to the last passed week', () => {
    expect(student(tenTwos, {}, tenTwos, dateOf(3)).expectedByNow).toBe(104)
    expect(student(tenTwos, {}, tenTwos, dayAfter(3)).expectedByNow).toBe(106)
  })

  it('Expected by now ignores weeks with a juz test', () => {
    expect(student(tenTwos, {}, tenTwos, dayAfter(3), { testWeeks: [2] }).expectedByNow).toBe(104)
  })

  it('Total projected = pages before + all planned pages, unless the admin overrides it', () => {
    expect(student(tenTwos, {}, tenTwos, dateOf(1)).totalProjected).toBe(120)
    expect(student(tenTwos, {}, tenTwos, dateOf(1), { override: 150 }).totalProjected).toBe(150)
  })

  it('Status compares Total memorised with Expected by now', () => {
    expect(student(tenTwos, { 1: 'Y', 2: 'Y' }, tenTwos, dayAfter(2)).status).toBe('On track')
    expect(student(tenTwos, { 1: 'Y', 2: 'N' }, tenTwos, dayAfter(2)).status).toBe('Behind')
  })

  it('Status is blank when New Hifdh is tracked in juz or hizb rather than pages', () => {
    expect(student(Array(10).fill('1 hizb'), {}, [], dayAfter(2)).status).toBeNull()
  })

  it('Attendance = classes attended / classes passed, red below 90%', () => {
    const t = student(tenTwos, {}, tenTwos, dayAfter(4), { absent: [2] })
    expect(t.weeksAbsent).toBe(1)
    expect(t.classesPassed).toBe(4)
    expect(t.attendancePct).toBe(75)
    expect(t.attendanceLow).toBe(true)
  })

  it('absence during an exception period does not count against attendance', () => {
    const t = student(tenTwos, {}, tenTwos, dayAfter(4), { absent: [2], exception: [2] })
    expect(t.attendancePct).toBe(100)
    expect(t.attendanceLow).toBe(false)
  })
})

describe('7.6 colours', () => {
  const l = line('prev5', '5 previous pages')
  const p = plans('A', 'B', 'C', 'D', 'Juz 29 Test', 'Juz 28 Test', 'Juz 27 Test')

  it('applies colours from the value', () => {
    const cells = run(l, p, { 1: 'Y', 2: '1.5', 3: 'N', 6: 'Pass', 7: 'Redo' }, dayAfter(7), [4])
    expect(cells[0].colour).toBe('green')
    expect(cells[1].colour).toBe('amber')
    expect(cells[2].colour).toBe('red')
    expect(cells[3].colour).toBe('red')
    expect(cells[4].colour).toBe('test-due')
    expect(cells[5].colour).toBe('test-pass')
    expect(cells[6].colour).toBe('test-fail')
  })

  it('an empty box after the week has passed has no fill', () => {
    expect(run(l, p, {}, dayAfter(1))[0].colour).toBe('none')
  })
})

describe('7.7 tested-by initials', () => {
  it('splits the done value from the initials', () => {
    expect(splitValueAndInitials('Y MMA')).toEqual({ value: 'Y', initials: 'MMA' })
    expect(splitValueAndInitials('1.5 ab')).toEqual({ value: '1.5', initials: 'AB' })
    expect(splitValueAndInitials('Juz 29 Test Pass AB')).toEqual({ value: 'Pass', initials: 'AB' })
    expect(splitValueAndInitials('Absent')).toEqual({ value: 'Absent', initials: null })
    expect(splitValueAndInitials('Redo')).toEqual({ value: 'Redo', initials: null })
  })

  it('classifies done values', () => {
    expect(classifyResult('Y')).toBe('Y')
    expect(classifyResult('n')).toBe('N')
    expect(classifyResult('2.5')).toBe('part')
    expect(classifyResult('Absent')).toBe('absent')
    expect(classifyResult('Redo')).toBe('fail')
    expect(classifyResult('')).toBe('empty')
  })
})

describe('T4 / T5 juz tracking', () => {
  it('fills the current juz forward from the week it changes', () => {
    const juz = juzByWeek(WEEKS, plans('Juz 29', null, null, 'Juz 28', null))
    expect([...juz.values()].slice(0, 6)).toEqual([29, 29, 29, 28, 28, 28])
  })

  it('reads the juz from a test target', () => {
    expect(testJuz('Juz 29 Test')).toBe(29)
    expect(testJuz('5 Juz Test')).toBeNull()
  })
})

describe('7.8 ordering', () => {
  it('sorts by first name ignoring titles', () => {
    expect(nameSortKey('Dr. Ahmed Ali')).toBe('ahmed ali')
    expect(nameSortKey('Hafidh Sh. Yusuf')).toBe('yusuf')
    const names = ['Sh. Zaid', 'Md. Bilal', 'Dr. Adam', 'Hafidh Omar', 'Ibrahim']
    expect([...names].sort(compareNames)).toEqual(['Dr. Adam', 'Md. Bilal', 'Ibrahim', 'Hafidh Omar', 'Sh. Zaid'])
  })
})
