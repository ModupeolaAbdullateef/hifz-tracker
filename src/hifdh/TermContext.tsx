import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { todayLondonISO } from '../lib/dates'
import { absentRpcArgs, getBootstrap, getTermData, resultRpcArgs, setTargets as apiSetTargets } from './api'
import { buildTermView, patchAbsent, patchResult, patchTargets, type TermView } from './model'
import { queueWrite } from './sync'
import type { Bootstrap, Group, Term, TermPayload } from './types'

interface TermContextValue {
  boot: Bootstrap | null
  groups: Group[]
  group: Group | null
  terms: Term[]
  term: Term | null
  view: TermView | null
  today: string
  loading: boolean
  error: string | null
  /** The initials stamped on results; defaults to the logged-in teacher's. */
  initials: string
  setInitials: (i: string) => void
  selectGroup: (id: number) => void
  selectTerm: (id: number) => void
  reloadBoot: () => Promise<void>
  reloadTerm: () => Promise<void>
  saveResult: (lineId: string, week: number, value: string, note?: string | null, initials?: string | null) => Promise<void>
  setAbsent: (studentId: string, week: number, absent: boolean) => Promise<void>
  saveTargets: (lineId: string, field: 'plan' | 'override', items: { week: number; text: string | null }[]) => Promise<void>
}

const TermContext = createContext<TermContextValue | undefined>(undefined)

const GROUP_KEY = 'hifdh_group'
const TERM_KEY = 'hifdh_term'

function readNumber(key: string): number | null {
  try {
    const v = localStorage.getItem(key)
    return v ? Number(v) : null
  } catch {
    return null
  }
}

function writeNumber(key: string, v: number) {
  try {
    localStorage.setItem(key, String(v))
  } catch {
    // ignore
  }
}

export function TermProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [boot, setBoot] = useState<Bootstrap | null>(null)
  const [groupId, setGroupId] = useState<number | null>(() => session?.group_id ?? readNumber(GROUP_KEY))
  const [termId, setTermId] = useState<number | null>(() => readNumber(TERM_KEY))
  const [payload, setPayload] = useState<TermPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [initials, setInitials] = useState(session?.initials ?? '')
  const today = todayLondonISO()

  const reloadBoot = useCallback(async () => {
    if (!session) return
    try {
      setBoot(await getBootstrap(session.token))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the portal.')
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void reloadBoot()
  }, [reloadBoot])

  const groups = boot?.groups ?? []
  const group = groups.find((g) => g.id === groupId) ?? groups[0] ?? null
  const terms = useMemo(() => (boot?.terms ?? []).filter((t) => t.group_id === group?.id), [boot, group?.id])
  const term = terms.find((t) => t.id === termId) ?? terms.find((t) => !t.archived) ?? terms[0] ?? null

  const reloadTerm = useCallback(async () => {
    if (!session || !term) {
      setPayload(null)
      if (boot) setLoading(false)
      return
    }
    setLoading(true)
    try {
      setPayload(await getTermData(session.token, term.id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this term.')
    } finally {
      setLoading(false)
    }
  }, [session, term, boot])

  useEffect(() => {
    void reloadTerm()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token, term?.id, boot])

  const view = useMemo(() => (payload ? buildTermView(payload, today) : null), [payload, today])

  const selectGroup = useCallback((id: number) => {
    writeNumber(GROUP_KEY, id)
    setGroupId(id)
    setTermId(null)
  }, [])

  const selectTerm = useCallback((id: number) => {
    writeNumber(TERM_KEY, id)
    setTermId(id)
  }, [])

  const by = session ? `${session.display_name}${session.initials ? ` (${session.initials})` : ''}` : ''

  const saveResult = useCallback(
    async (lineId: string, week: number, value: string, note: string | null = null, who: string | null = null) => {
      if (!session) return
      const stamp = (who ?? initials).trim().toUpperCase() || null
      setPayload((p) => (p ? patchResult(p, lineId, week, value, value ? stamp : null, note, by) : p))
      await queueWrite(`result:${lineId}:${week}`, 'hf_set_result', resultRpcArgs(session.token, { lineId, week, value, initials: stamp, note }))
    },
    [session, initials, by],
  )

  const setAbsent = useCallback(
    async (studentId: string, week: number, absent: boolean) => {
      if (!session || !term) return
      const stamp = initials.trim().toUpperCase() || null
      setPayload((p) => (p ? patchAbsent(p, studentId, week, absent, stamp, by) : p))
      await queueWrite(
        `absent:${studentId}:${week}`,
        'hf_set_absent',
        absentRpcArgs(session.token, { termId: term.id, studentId, week, absent, initials: stamp }),
      )
    },
    [session, term, initials, by],
  )

  const saveTargets = useCallback(
    async (lineId: string, field: 'plan' | 'override', items: { week: number; text: string | null }[]) => {
      if (!session) return
      setPayload((p) => (p ? patchTargets(p, lineId, field, items) : p))
      await apiSetTargets(session.token, lineId, field, items)
    },
    [session],
  )

  const value: TermContextValue = {
    boot,
    groups,
    group,
    terms,
    term,
    view,
    today,
    loading: loading && !payload,
    error,
    initials,
    setInitials,
    selectGroup,
    selectTerm,
    reloadBoot,
    reloadTerm,
    saveResult,
    setAbsent,
    saveTargets,
  }

  return <TermContext.Provider value={value}>{children}</TermContext.Provider>
}

export function useTerm() {
  const ctx = useContext(TermContext)
  if (!ctx) throw new Error('useTerm must be used within TermProvider')
  return ctx
}
