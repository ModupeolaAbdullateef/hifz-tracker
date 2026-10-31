import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { listCourses } from '../lib/api'
import { loadSelectedCourseId, saveSelectedCourseId } from '../lib/session'
import type { CourseSummary } from '../lib/types'
import { useAuth } from './AuthContext'

interface CourseContextValue {
  courses: CourseSummary[]
  /** The course the staff pages are currently showing. Null only while loading or if there are no courses. */
  course: CourseSummary | null
  loading: boolean
  error: string | null
  selectCourse: (id: number) => void
  /** Re-fetches the course list, e.g. after the admin adds or edits a course. */
  refresh: () => Promise<void>
}

const CourseContext = createContext<CourseContextValue | undefined>(undefined)

export function CourseProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(() => loadSelectedCourseId())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!session) return
    try {
      setCourses(await listCourses(session.token))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load courses.')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    refresh()
  }, [refresh])

  const selectCourse = useCallback((id: number) => {
    saveSelectedCourseId(id)
    setSelectedId(id)
  }, [])

  // Fall back to the first active course when nothing (or a deleted course) is selected.
  const course = courses.find((c) => c.id === selectedId) ?? courses.find((c) => c.active) ?? courses[0] ?? null

  const value = useMemo<CourseContextValue>(
    () => ({ courses, course, loading, error, selectCourse, refresh }),
    [courses, course, loading, error, selectCourse, refresh],
  )

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>
}

export function useCourse() {
  const ctx = useContext(CourseContext)
  if (!ctx) throw new Error('useCourse must be used within CourseProvider')
  return ctx
}
