export type FieldType = 'number' | 'yesno'

export interface Resource {
  id: string
  title: string
  description: string | null
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  sort_order: number
  active: boolean
}

export interface RecordField {
  key: string
  label: string
  type: FieldType
  unit: string | null
  sort_order: number
  active: boolean
}

export interface CourseWeek {
  week_number: number
  class_date: string // ISO date, YYYY-MM-DD
  cancelled: boolean
  note: string | null
}

export interface Course {
  name: string
  start_date: string
  weeks: number
  class_weekday: number
  target_pages: number | null
}

export interface StudentPublic {
  id: string
  first_name: string
  last_initial: string
}

export interface StudentFull {
  id: string
  first_name: string
  last_name: string
  student_code: string
  join_week: number
  target_pages: number | null
  active: boolean
}

export type RecordValues = Record<string, number | boolean | null>

export interface WeeklyRecord {
  student_id: string
  week_number: number
  status: 'present' | 'absent'
  good_week: boolean
  values: RecordValues
  note: string | null
  next_assignment: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface Badge {
  badge_key: string
  awarded_at: string
}

export interface Tip {
  id: string
  category: 'technique' | 'schedule' | 'announcement'
  text: string
  active: boolean
  sort_order: number
}

export interface StudentRecordBundle {
  student: StudentFull
  course: Course
  weeks: CourseWeek[]
  fields: RecordField[]
  records: WeeklyRecord[]
  totals: {
    new_hifz_total: number
    old_hifz_total: number
    weeks_present: number
    weeks_recorded: number
    good_weeks: number
  }
  badges: Badge[]
}

export type StaffRole = 'teacher' | 'admin'

export interface StaffSession {
  token: string
  role: StaffRole
  display_name: string
  expires_at: string
}

export interface ClassOverviewRow {
  student_id: string
  first_name: string
  last_name: string
  new_hifz_total: number
  old_hifz_total: number
  attendance_pct: number
  good_weeks: number
  last_recorded_week: number | null
  on_track: boolean | null
}

export interface WeekRosterRow {
  student_id: string
  first_name: string
  last_name: string
  has_record: boolean
  status: 'present' | 'absent' | null
  good_week: boolean
}
