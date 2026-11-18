import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { SESSION_EXPIRED_EVENT, staffLogout } from '../lib/api'
import { clearStaffSession, loadStaffSession, saveStaffSession } from '../lib/session'
import type { StaffSession } from '../lib/types'

interface AuthContextValue {
  session: StaffSession | null
  isAdmin: boolean
  login: (displayName: string, code: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(() => loadStaffSession())

  const login = useCallback(async (displayName: string, code: string) => {
    const { data, error } = await supabase.rpc('staff_login', {
      p_display_name: displayName,
      p_code: code,
    })
    if (error) throw new Error(error.message)
    if (!data || !data.token) throw new Error('Incorrect name or access code.')
    const newSession: StaffSession = {
      token: data.token,
      role: data.role,
      display_name: displayName,
      expires_at: data.expires_at,
    }
    saveStaffSession(newSession)
    setSession(newSession)
  }, [])

  // After 12 hours (or if the server rejects the login) drop the session so
  // the staff pages send the user back to the login screen.
  useEffect(() => {
    if (!session) return
    const expire = () => {
      clearStaffSession()
      setSession(null)
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, expire)
    const ms = new Date(session.expires_at).getTime() - Date.now()
    const timer = window.setTimeout(expire, Math.max(0, Math.min(ms, 2 ** 31 - 1)))
    return () => {
      window.removeEventListener(SESSION_EXPIRED_EVENT, expire)
      window.clearTimeout(timer)
    }
  }, [session])

  const logout = useCallback(async () => {
    if (session) {
      await staffLogout(session.token).catch(() => undefined)
    }
    clearStaffSession()
    setSession(null)
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAdmin: session?.role === 'admin', login, logout }),
    [session, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
