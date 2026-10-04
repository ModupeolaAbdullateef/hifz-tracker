import type { CourseWeek } from './types'

const LONDON_TZ = 'Europe/London'

/** Today's date as YYYY-MM-DD in Europe/London, independent of the viewer's own timezone. */
export function todayLondonISO(): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date())
}

/** YYYY-MM-DD -> DD/MM/YYYY (UK format). */
export function formatUKDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * The current week is the most recent class week on or before today (Europe/London).
 * Before the course starts, this returns week 1 so the UI has a sensible default.
 */
export function getCurrentWeekNumber(weeks: CourseWeek[]): number {
  if (weeks.length === 0) return 1
  const today = todayLondonISO()
  let current = weeks[0].week_number
  for (const w of weeks) {
    if (w.class_date <= today) {
      current = w.week_number
    }
  }
  return current
}

export function weekByNumber(weeks: CourseWeek[], weekNumber: number): CourseWeek | undefined {
  return weeks.find((w) => w.week_number === weekNumber)
}

export function isFutureWeek(week: CourseWeek): boolean {
  return week.class_date > todayLondonISO()
}
