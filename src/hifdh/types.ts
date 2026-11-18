import type { Line, LineType, Result, Week } from './rules'

export interface Group {
  id: number
  name: string
}

export interface Term {
  id: number
  group_id: number
  name: string
  start_date: string
  archived: boolean
}

export interface Teacher {
  id: string
  group_id: number
  name: string
  initials: string
  colour: string | null
  student_id: string | null
  active: boolean
}

export interface TermStudent {
  id: string
  code: string
  display_name: string
  status: 'active' | 'left' | 'archived'
  notes: string | null
  is_teacher: boolean
  pages_before: number
  projected_override: number | null
  paid: boolean
  exception_from: string | null
  exception_until: string | null
}

export interface TargetRow {
  line_id: string
  week: number
  plan: string | null
  override: string | null
}

export interface AttendanceRow {
  student_id: string
  week: number
  absent: boolean
  initials: string | null
}

export interface PairMember {
  student_id: string | null
  is_me?: boolean
  display_name: string
  revising: string | null
}

export interface Pair {
  id: number
  pair_number: number
  members: PairMember[]
}

export interface Note {
  id: string
  student_id: string
  author: string
  text: string
  visible_to_student: boolean
  created_at: string
}

export interface SelfCheck {
  line_id: string
  week: number
  checked_at: string
}

export interface TermPayload {
  term: Term
  weeks: Week[]
  students: TermStudent[]
  lines: Line[]
  targets: TargetRow[]
  results: Result[]
  attendance: AttendanceRow[]
  pairs: Pair[]
  notes: Note[]
  selfchecks: SelfCheck[]
}

export interface Bootstrap {
  groups: Group[]
  terms: Term[]
  teachers: Teacher[]
}

export interface AdminStudent {
  id: string
  group_id: number
  code: string
  display_name: string
  status: 'active' | 'left' | 'archived'
  notes: string | null
  link_token: string
  pin: string
  term_ids: number[]
}

export interface LineTemplate {
  label: string
  type: LineType
  has_done: boolean
  done_label: string | null
}

/** The lines a new student usually gets, matching the Overview sheet. */
export const LINE_TEMPLATES: LineTemplate[] = [
  { label: 'New Hifdh', type: 'new_hifdh', has_done: true, done_label: 'New Hifdh done' },
  { label: 'Planned pages', type: 'planned_pages', has_done: false, done_label: null },
  { label: 'Juz', type: 'juz', has_done: false, done_label: null },
  { label: '5 previous pages', type: 'prev5', has_done: true, done_label: '5 previous pages done' },
  { label: 'Revision', type: 'revision', has_done: true, done_label: 'Revision done' },
  { label: 'Previous Half', type: 'half_revision', has_done: true, done_label: 'Revision done' },
  { label: 'Old Half', type: 'half_revision', has_done: true, done_label: 'Revision done' },
  { label: 'Juz tests', type: 'juz_tests', has_done: true, done_label: 'Test result' },
]

export const DEFAULT_TEMPLATE_LABELS = ['New Hifdh', 'Planned pages', 'Juz', '5 previous pages', 'Revision', 'Juz tests']

export interface AuditEntry {
  id: number
  at: string
  actor: string
  action: string
  entity: string
  entity_key: Record<string, unknown>
  student_id: string | null
  student_name: string | null
  line_label: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

export interface StudentOpenPayload {
  student: { id: string; code: string; display_name: string; group: string }
  terms: TermPayload[]
}
