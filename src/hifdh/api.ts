import { supabase } from '../lib/supabase'
import { SESSION_EXPIRED_EVENT } from '../lib/api'
import type { LineType } from './rules'
import type {
  AdminStudent,
  AuditEntry,
  Bootstrap,
  StudentOpenPayload,
  TermPayload,
} from './types'

export class NetworkError extends Error {}

function isNetworkFailure(message: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new NetworkError('You are offline.')
  }
  let res
  try {
    res = await supabase.rpc(fn, args)
  } catch (e) {
    throw new NetworkError(e instanceof Error ? e.message : 'Network error')
  }
  const { data, error } = res
  if (error) {
    if (isNetworkFailure(error.message)) throw new NetworkError(error.message)
    if ('p_token' in args && /session expired|not signed in/i.test(error.message)) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    throw new Error(error.message)
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && 'error' in data && typeof data.error === 'string') {
    throw new Error(data.error)
  }
  return data as T
}

// ---------- Login ----------

export interface LoginStart {
  role: 'admin' | 'teacher'
  group_id: number | null
  group_name: string | null
  teachers: { id: string; name: string; initials: string; group_id: number; group_name: string }[]
}

export const loginStart = (code: string) => rpc<LoginStart>('hf_login_start', { p_code: code })

export interface LoginResult {
  token: string
  role: 'admin' | 'teacher'
  group_id: number | null
  display_name: string
  initials: string
  teacher_id: string | null
  expires_at: string
}

export const login = (code: string, teacherId: string | null, name: string | null, initials: string | null) =>
  rpc<LoginResult>('hf_login', { p_code: code, p_teacher_id: teacherId, p_name: name, p_initials: initials })

// ---------- Reading ----------

export const getBootstrap = (token: string) => rpc<Bootstrap>('hf_bootstrap', { p_token: token })

export const getTermData = (token: string, termId: number) =>
  rpc<TermPayload>('hf_term_data', { p_token: token, p_term_id: termId })

export const getStudentHistory = (token: string, studentId: string) =>
  rpc<TermPayload[]>('hf_student_history', { p_token: token, p_student_id: studentId })

// ---------- Recording ----------

export interface ResultArgs {
  lineId: string
  week: number
  value: string
  initials: string | null
  note: string | null
}

export const resultRpcArgs = (token: string, a: ResultArgs) => ({
  p_token: token,
  p_line_id: a.lineId,
  p_week: a.week,
  p_value: a.value,
  p_initials: a.initials,
  p_note: a.note,
})

export interface AbsentArgs {
  termId: number
  studentId: string
  week: number
  absent: boolean
  initials: string | null
}

export const absentRpcArgs = (token: string, a: AbsentArgs) => ({
  p_token: token,
  p_term_id: a.termId,
  p_student_id: a.studentId,
  p_week: a.week,
  p_absent: a.absent,
  p_initials: a.initials,
})

export const setTargets = (
  token: string,
  lineId: string,
  field: 'plan' | 'override',
  targets: { week: number; text: string | null }[],
) => rpc<void>('hf_set_targets', { p_token: token, p_line_id: lineId, p_field: field, p_targets: targets })

export const addNote = (token: string, studentId: string, text: string, visible: boolean) =>
  rpc<void>('hf_add_note', { p_token: token, p_student_id: studentId, p_text: text, p_visible: visible })

export const setNoteVisibility = (token: string, noteId: string, visible: boolean) =>
  rpc<void>('hf_set_note_visibility', { p_token: token, p_note_id: noteId, p_visible: visible })

export const deleteNote = (token: string, noteId: string) =>
  rpc<void>('hf_delete_note', { p_token: token, p_note_id: noteId })

// ---------- Admin: students and lines ----------

export const getAdminStudents = (token: string, groupId: number) =>
  rpc<AdminStudent[]>('hf_admin_students', { p_token: token, p_group_id: groupId })

export interface UpsertStudentArgs {
  id: string | null
  groupId: number
  code: string
  displayName: string
  notes: string | null
  termId: number | null
  pagesBefore: number | null
  startingJuz: number | null
  lines: { label: string; type: LineType; has_done: boolean; done_label: string | null }[]
}

export const upsertStudent = (token: string, a: UpsertStudentArgs) =>
  rpc<{ id: string; code: string; link_token: string; pin: string }>('hf_upsert_student', {
    p_token: token,
    p_id: a.id,
    p_group_id: a.groupId,
    p_code: a.code,
    p_display_name: a.displayName,
    p_notes: a.notes,
    p_term_id: a.termId,
    p_pages_before: a.pagesBefore,
    p_starting_juz: a.startingJuz,
    p_lines: a.lines,
  })

export const setStudentStatus = (token: string, studentId: string, status: 'active' | 'left' | 'archived') =>
  rpc<void>('hf_set_student_status', { p_token: token, p_student_id: studentId, p_status: status })

export const resetPin = (token: string, studentId: string) =>
  rpc<string>('hf_reset_pin', { p_token: token, p_student_id: studentId })

export const deleteStudent = (token: string, studentId: string) =>
  rpc<void>('hf_delete_student', { p_token: token, p_student_id: studentId })

export const exportStudentData = (token: string, studentId: string) =>
  rpc<unknown>('hf_export_student', { p_token: token, p_student_id: studentId })

export interface EnrolmentArgs {
  termId: number
  studentId: string
  pagesBefore: number
  projectedOverride: number | null
  paid: boolean
  exceptionFrom: string | null
  exceptionUntil: string | null
}

export const setEnrolment = (token: string, a: EnrolmentArgs) =>
  rpc<void>('hf_set_enrolment', {
    p_token: token,
    p_term_id: a.termId,
    p_student_id: a.studentId,
    p_pages_before: a.pagesBefore,
    p_projected_override: a.projectedOverride,
    p_paid: a.paid,
    p_exception_from: a.exceptionFrom,
    p_exception_until: a.exceptionUntil,
  })

export const setPaid = (token: string, termId: number, studentId: string, paid: boolean) =>
  rpc<void>('hf_set_paid', { p_token: token, p_term_id: termId, p_student_id: studentId, p_paid: paid })

export const removeEnrolment = (token: string, termId: number, studentId: string) =>
  rpc<void>('hf_remove_enrolment', { p_token: token, p_term_id: termId, p_student_id: studentId })

export const upsertLine = (
  token: string,
  a: { id: string | null; termId: number; studentId: string; label: string; type: LineType; hasDone: boolean; doneLabel: string | null },
) =>
  rpc<string>('hf_upsert_line', {
    p_token: token,
    p_id: a.id,
    p_term_id: a.termId,
    p_student_id: a.studentId,
    p_label: a.label,
    p_type: a.type,
    p_has_done: a.hasDone,
    p_done_label: a.doneLabel,
  })

export const deleteLine = (token: string, lineId: string) => rpc<void>('hf_delete_line', { p_token: token, p_line_id: lineId })

export const reorderLines = (token: string, lineIds: string[]) =>
  rpc<void>('hf_reorder_lines', { p_token: token, p_line_ids: lineIds })

// ---------- Admin: terms, teachers, codes, partners ----------

export const createTerm = (token: string, groupId: number, name: string, startDate: string, copyFrom: number | null) =>
  rpc<number>('hf_create_term', {
    p_token: token,
    p_group_id: groupId,
    p_name: name,
    p_start_date: startDate,
    p_weeks: 10,
    p_copy_from: copyFrom,
  })

export const updateTerm = (token: string, termId: number, name: string | null, archived: boolean | null) =>
  rpc<void>('hf_update_term', { p_token: token, p_term_id: termId, p_name: name, p_archived: archived })

export const deleteTerm = (token: string, termId: number) => rpc<void>('hf_delete_term', { p_token: token, p_term_id: termId })

export const updateWeek = (token: string, termId: number, week: number, classDate: string | null, cancelled: boolean | null) =>
  rpc<void>('hf_update_week', {
    p_token: token,
    p_term_id: termId,
    p_week: week,
    p_class_date: classDate,
    p_cancelled: cancelled,
  })

export const upsertTeacher = (
  token: string,
  t: { id: string | null; groupId: number; name: string; initials: string; colour: string | null; studentId: string | null; active: boolean },
) =>
  rpc<string>('hf_upsert_teacher', {
    p_token: token,
    p_id: t.id,
    p_group_id: t.groupId,
    p_name: t.name,
    p_initials: t.initials,
    p_colour: t.colour,
    p_student_id: t.studentId,
    p_active: t.active,
  })

export const deleteTeacher = (token: string, id: string) => rpc<void>('hf_delete_teacher', { p_token: token, p_id: id })

export const setGroupCode = (token: string, groupId: number, code: string) =>
  rpc<void>('hf_set_group_code', { p_token: token, p_group_id: groupId, p_code: code })

export const setAdminCode = (token: string, code: string) =>
  rpc<void>('set_codes', { p_token: token, p_new_teacher_code: null, p_new_admin_code: code })

export const setPairs = (
  token: string,
  termId: number,
  pairs: { pair_number: number; members: { student_id: string; revising: string | null }[] }[],
) => rpc<void>('hf_set_pairs', { p_token: token, p_term_id: termId, p_pairs: pairs })

// ---------- Admin: audit and import ----------

export const getAudit = (token: string, limit: number, studentId: string | null) =>
  rpc<AuditEntry[]>('hf_audit_list', { p_token: token, p_limit: limit, p_student_id: studentId })

export const undoAudit = (token: string, id: number) => rpc<void>('hf_audit_undo', { p_token: token, p_audit_id: id })

export const importTerm = (token: string, payload: unknown) =>
  rpc<Record<string, number>>('hf_import', { p_token: token, p_payload: payload })

// ---------- Students ----------

export const studentOpen = (link: string, pin: string) =>
  rpc<StudentOpenPayload>('hf_student_open', { p_link: link, p_pin: pin })

export const studentSelfCheck = (link: string, pin: string, lineId: string, week: number, checked: boolean) =>
  rpc<void>('hf_student_selfcheck', { p_link: link, p_pin: pin, p_line_id: lineId, p_week: week, p_checked: checked })
