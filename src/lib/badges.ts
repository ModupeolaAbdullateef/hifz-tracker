export const BADGE_LABELS: Record<string, string> = {
  first_record: 'First record',
  first_good_week: 'First good week',
  three_good_weeks: '3 good weeks',
  perfect_attendance: 'Perfect attendance so far',
  pages_1: '1 page of New Hifz',
  pages_5: '5 pages of New Hifz',
  pages_10: '10 pages of New Hifz',
  target_reached: 'Target reached',
}

export function badgeLabel(key: string): string {
  return BADGE_LABELS[key] ?? key.replace(/_/g, ' ')
}
