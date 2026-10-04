import type { StaffSession } from './types'

const STAFF_KEY = 'hifz_staff_session'
const STUDENT_KEY = 'hifz_student_session'

export function loadStaffSession(): StaffSession | null {
  const raw = sessionStorage.getItem(STAFF_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as StaffSession
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      sessionStorage.removeItem(STAFF_KEY)
      return null
    }
    return session
  } catch {
    return null
  }
}

export function saveStaffSession(session: StaffSession) {
  sessionStorage.setItem(STAFF_KEY, JSON.stringify(session))
}

export function clearStaffSession() {
  sessionStorage.removeItem(STAFF_KEY)
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
