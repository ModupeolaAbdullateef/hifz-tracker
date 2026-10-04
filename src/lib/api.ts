import { supabase } from './supabase'
import type {
  ClassOverviewRow,
  Course,
  CourseWeek,
  RecordField,
  RecordValues,
  Resource,
  StudentFull,
  StudentPublic,
  StudentRecordBundle,
  Tip,
  WeekRosterRow,
} from './types'

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

// ---------- Public ----------

export const searchStudentsPublic = (q: string) => call<StudentPublic[]>('search_students', { p_q: q })

export const getStudentRecord = (studentId: string, code: string) =>
  call<StudentRecordBundle>('get_student_record', { p_student_id: studentId, p_code: code })

export const getActiveTips = () => call<Tip[]>('get_active_tips')

export const getActiveResources = () => call<Resource[]>('get_active_resources')

// ---------- Staff auth ----------

export const staffLogout = (token: string) => call<void>('staff_logout', { p_token: token })

// ---------- Teacher ----------

export const staffSearchStudents = (token: string, q: string) =>
  call<StudentFull[]>('staff_search_students', { p_token: token, p_q: q })

export const getStudentGrid = (token: string, studentId: string) =>
  call<StudentRecordBundle>('get_student_grid', { p_token: token, p_student_id: studentId })

export interface SaveWeeklyRecordArgs {
  studentId: string
  weekNumber: number
  status: 'present' | 'absent'
  goodWeek: boolean
  values: RecordValues
  note: string | null
  nextAssignment: string | null
}

export const saveWeeklyRecord = (token: string, args: SaveWeeklyRecordArgs) =>
  call<void>('save_weekly_record', {
    p_token: token,
    p_student_id: args.studentId,
    p_week_number: args.weekNumber,
    p_status: args.status,
    p_good_week: args.goodWeek,
    p_values: args.values,
    p_note: args.note,
    p_next_assignment: args.nextAssignment,
  })

export const getWeekRoster = (token: string, weekNumber: number) =>
  call<WeekRosterRow[]>('get_week_roster', { p_token: token, p_week_number: weekNumber })

export const getClassOverview = (token: string) => call<ClassOverviewRow[]>('get_class_overview', { p_token: token })

// ---------- Admin ----------

export interface UpsertStudentArgs {
  id?: string
  firstName: string
  lastName: string
  joinWeek: number
  targetPages: number | null
}

export const upsertStudent = (token: string, args: UpsertStudentArgs) =>
  call<{ id: string; student_code: string }>('upsert_student', {
    p_token: token,
    p_id: args.id ?? null,
    p_first_name: args.firstName,
    p_last_name: args.lastName,
    p_join_week: args.joinWeek,
    p_target_pages: args.targetPages,
  })

export const deactivateStudent = (token: string, studentId: string, active: boolean) =>
  call<void>('deactivate_student', { p_token: token, p_student_id: studentId, p_active: active })

export const regenerateStudentCode = (token: string, studentId: string) =>
  call<{ student_code: string }>('regenerate_student_code', { p_token: token, p_student_id: studentId })

export const updateCourse = (
  token: string,
  args: { name: string; startDate: string; weeks: number; targetPages: number | null },
) =>
  call<void>('update_course', {
    p_token: token,
    p_name: args.name,
    p_start_date: args.startDate,
    p_weeks: args.weeks,
    p_target_pages: args.targetPages,
  })

export const setWeekCancelled = (token: string, weekNumber: number, cancelled: boolean, note: string | null) =>
  call<void>('set_week_cancelled', { p_token: token, p_week_number: weekNumber, p_cancelled: cancelled, p_note: note })

export const upsertRecordField = (
  token: string,
  args: { key: string; label: string; type: 'number' | 'yesno'; unit: string | null; sortOrder: number; active: boolean },
) =>
  call<void>('upsert_record_field', {
    p_token: token,
    p_key: args.key,
    p_label: args.label,
    p_type: args.type,
    p_unit: args.unit,
    p_sort_order: args.sortOrder,
    p_active: args.active,
  })

export const upsertTip = (
  token: string,
  args: { id?: string; category: Tip['category']; text: string; active: boolean; sortOrder: number },
) =>
  call<void>('upsert_tip', {
    p_token: token,
    p_id: args.id ?? null,
    p_category: args.category,
    p_text: args.text,
    p_active: args.active,
    p_sort_order: args.sortOrder,
  })

export const deleteTip = (token: string, id: string) => call<void>('delete_tip', { p_token: token, p_id: id })

export const setCodes = (token: string, newTeacherCode: string | null, newAdminCode: string | null) =>
  call<void>('set_codes', { p_token: token, p_new_teacher_code: newTeacherCode, p_new_admin_code: newAdminCode })

export const exportClass = (token: string) => call<Record<string, unknown>[]>('export_class', { p_token: token })

export const getAllStudentsAdmin = (token: string) => call<StudentFull[]>('admin_list_students', { p_token: token })

export const getAllTipsAdmin = (token: string) => call<Tip[]>('admin_list_tips', { p_token: token })

export const getRecordFieldsAdmin = (token: string) => call<RecordField[]>('get_record_fields', { p_token: token })

export const getCourseWeeksAdmin = (token: string) => call<CourseWeek[]>('get_course_weeks', { p_token: token })

export const getCourseAdmin = (token: string) => call<Course>('get_course', { p_token: token })

export const getResourcesAdmin = (token: string) => call<Resource[]>('admin_list_resources', { p_token: token })

export interface UpsertResourceMetaArgs {
  id?: string
  title: string
  description: string | null
  storagePath: string
  fileName: string
  mimeType: string | null
  sizeBytes: number
  sortOrder: number
  active: boolean
}

export const upsertResourceMeta = (token: string, args: UpsertResourceMetaArgs) =>
  call<string>('upsert_resource_meta', {
    p_token: token,
    p_id: args.id ?? null,
    p_title: args.title,
    p_description: args.description,
    p_storage_path: args.storagePath,
    p_file_name: args.fileName,
    p_mime_type: args.mimeType,
    p_size_bytes: args.sizeBytes,
    p_sort_order: args.sortOrder,
    p_active: args.active,
  })

/** Returns the deleted row's storage_path so the caller can also remove the file from Storage. */
export const deleteResourceMeta = (token: string, id: string) =>
  call<string | null>('delete_resource', { p_token: token, p_id: id })
