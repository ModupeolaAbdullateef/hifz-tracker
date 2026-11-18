import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { inferLineType, parseWorkbook } from './importExcel'

// A small workbook laid out as section 8.3 describes the real record sheets.
function sampleWorkbook() {
  const dates = Array.from({ length: 10 }, (_, i) => new Date(2026, 9, 15 + i * 7))
  const blank = (n: number) => Array(n).fill(null)
  // Columns: A label, B-D blank, E pages before, F-O weeks, P total, Q expected, R projected, S status, T ID, U absent, V attendance
  const overview = [
    ['Name', null, null, null, 'Before', ...Array.from({ length: 10 }, (_, i) => i + 1), 'Total memorised', 'Expected by now', 'Total projected', 'Status', 'ID', 'Weeks absent', 'Attendance'],
    [null, null, null, null, null, ...dates],
    ['Student 01', null, null, null, 20, ...blank(10), 22.5, 22.5, 45, 'On track', 'B01', 1, 0.5],
    ['New Hifdh', null, null, null, null, '2.5', '2.5', '2.5', ...blank(7)],
    ['New Hifdh done', null, null, null, null, 'Y MMA', 'Absent', ...blank(8)],
    ['Planned pages', null, null, null, null, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 2.5],
    ['Juz', null, null, null, null, 'Juz 30', ...blank(9)],
    ['Revision', null, null, null, null, '29 1st 1/4', '29 2nd 1/4', '29 3rd 1/4', ...blank(7)],
    ['Revise this week', null, null, null, null, '29 1st 1/4', ...blank(9)],
    ['Revision done', null, null, null, null, 'N AB', 'Absent', ...blank(8)],
    ['Juz tests', null, null, null, null, null, null, 'Juz 30 Test', ...blank(7)],
    ['Test result', null, null, null, null, null, null, 'Pass AB', ...blank(7)],
    ['Dr. Student 02', null, null, null, 0, ...blank(10), null, null, null, null, 'B02', 0, 1],
    ['Revision', null, null, null, null, '30 1st 1/2', ...blank(9)],
    ['Revision done', null, null, null, null, 'Y', ...blank(9)],
    [null, null, null, null, null, 'stray', ...blank(9)],
  ]
  const partners = [
    ['Pair', 'Student', 'Revising this round', 'Partner', 'Revising this round'],
    [1, 'Student 01', '29 1st 1/4', 'Dr. Student 02', '30 1st 1/2'],
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overview, { cellDates: true }), 'Overview')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(partners), 'Revision Partners')
  // Round-trip through a real .xlsx file so dates and types behave like an uploaded workbook.
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return XLSX.read(buf, { cellDates: true })
}

describe('A1 Excel import', () => {
  it('reads dates, students, lines, targets, results, absences and partners', async () => {
    const p = await parseWorkbook(sampleWorkbook())
    expect(p.dates[0]).toBe('2026-10-15')
    expect(p.dates).toHaveLength(10)
    expect(p.students.map((s) => s.code)).toEqual(['B01', 'B02'])

    const s1 = p.students.find((s) => s.code === 'B01')!
    expect(s1.pages_before).toBe(20)
    expect(s1.excel.attendance).toBe(50)
    expect(s1.lines.map((l) => l.label)).toEqual(['New Hifdh', 'Planned pages', 'Juz', 'Revision', 'Juz tests'])
    const nh = s1.lines[0]
    expect(nh.type).toBe('new_hifdh')
    expect(nh.has_done).toBe(true)
    expect(nh.targets['1']).toBe('2.5')
    expect(nh.results['1']).toEqual({ value: 'Y', initials: 'MMA' })
    expect(s1.lines[1].has_done).toBe(false)
    expect(s1.lines[3].results['1']).toEqual({ value: 'N', initials: 'AB' })
    expect(s1.lines[4].results['3']).toEqual({ value: 'Pass', initials: 'AB' })
    // Week 2 is Absent on every line that has a value; the empty Juz tests line doesn't stop it counting.
    expect(s1.absent_weeks).toEqual([2])

    expect(p.pairs).toEqual([
      { pair_number: 1, members: [{ code: 'B01', revising: '29 1st 1/4' }, { code: 'B02', revising: '30 1st 1/2' }] },
    ])
    expect(p.issues.some((i) => i.includes('no label'))).toBe(true)
    expect(p.counts.students).toBe(2)
  })

  it('skips the computed "Revise this week" rows', async () => {
    const p = await parseWorkbook(sampleWorkbook())
    expect(p.students[0].lines.some((l) => /revise this week/i.test(l.label))).toBe(false)
  })

  it('works out line types from the labels used on the sheet', () => {
    expect(inferLineType('New Hifdh')).toBe('new_hifdh')
    expect(inferLineType('Planned pages')).toBe('planned_pages')
    expect(inferLineType('Juz')).toBe('juz')
    expect(inferLineType('5 previous pages')).toBe('prev5')
    expect(inferLineType('Revision')).toBe('revision')
    expect(inferLineType('Previous Half')).toBe('half_revision')
    expect(inferLineType('Old Half')).toBe('half_revision')
    expect(inferLineType('Juz tests')).toBe('juz_tests')
    expect(inferLineType('Tajweed')).toBe('custom')
  })
})
