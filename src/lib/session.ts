import type { StaffSession } from './types'

const STAFF_KEY = 'hifz_staff_session'
const STUDENT_KEY = 'hifz_student_session'

// Staff sessions live in localStorage so they survive closing the tab or the
// browser: the server issues them for 12 hours, and the login screen only
// comes back once that time is up.
function staffStore(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadStaffSession(): StaffSession | null {
  try {
    const raw = staffStore()?.getItem(STAFF_KEY) ?? sessionStorage.getItem(STAFF_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as StaffSession
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      clearStaffSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveStaffSession(session: StaffSession) {
  try {
    staffStore()?.setItem(STAFF_KEY, JSON.stringify(session))
  } catch {
    // Storage blocked (private mode): the session lasts for this page only.
  }
}

export function clearStaffSession() {
  try {
    staffStore()?.removeItem(STAFF_KEY)
    sessionStorage.removeItem(STAFF_KEY)
  } catch {
    // ignore
  }
}

const COURSE_KEY = 'hifz_selected_course'

export function loadSelectedCourseId(): number | null {
  const raw = sessionStorage.getItem(COURSE_KEY)
  return raw ? Number(raw) : null
}

export function saveSelectedCourseId(id: number) {
  sessionStorage.setItem(COURSE_KEY, String(id))
}

export interface StudentSession {
  studentId: string
  code: string
}

export function loadStudentSession(): StudentSession | null {
  const raw = sessionStorage.getItem(STUDENT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as StudentSession
  } catch {
    return null
  }
}

export function saveStudentSession(session: StudentSession) {
  sessionStorage.setItem(STUDENT_KEY, JSON.stringify(session))
}

export function clearStudentSession() {
  sessionStorage.removeItem(STUDENT_KEY)
}
