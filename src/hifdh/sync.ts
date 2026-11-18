/**
 * Offline-tolerant saving for results and absences (8.1).
 *
 * Every write goes through `queueWrite`: it is tried straight away and, if
 * there is no signal, kept in localStorage and retried when the phone is
 * back online. Writes are replayed in order, and a later write to the same
 * box replaces an earlier queued one, so the last tap always wins.
 */
import { useEffect, useState } from 'react'
import { NetworkError, rpc } from './api'

interface QueuedWrite {
  key: string
  fn: string
  args: Record<string, unknown>
  queuedAt: string
}

const STORE_KEY = 'hifdh_pending_writes'
const CHANGE_EVENT = 'hifdh:pending-changed'

function load(): QueuedWrite[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as QueuedWrite[]
  } catch {
    return []
  }
}

let memoryQueue: QueuedWrite[] = load()

function save(queue: QueuedWrite[]) {
  memoryQueue = queue
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(queue))
  } catch {
    // Storage unavailable: the queue lives in memory until the page is closed.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function pendingCount(): number {
  return memoryQueue.length
}

let lastError: string | null = null
export function lastSyncError(): string | null {
  return lastError
}

/** Tries the write now; if offline, queues it. Resolves 'saved' or 'queued'; rejects on a real server error. */
export async function queueWrite(key: string, fn: string, args: Record<string, unknown>): Promise<'saved' | 'queued'> {
  // Anything queued for the same box must not overwrite this newer value later.
  if (memoryQueue.some((w) => w.key === key)) {
    save([...memoryQueue.filter((w) => w.key !== key), { key, fn, args, queuedAt: new Date().toISOString() }])
    void flush()
    return 'queued'
  }
  try {
    await rpc(fn, args)
    return 'saved'
  } catch (e) {
    if (e instanceof NetworkError) {
      save([...memoryQueue, { key, fn, args, queuedAt: new Date().toISOString() }])
      return 'queued'
    }
    throw e
  }
}

let flushing = false

export async function flush(): Promise<void> {
  if (flushing || memoryQueue.length === 0) return
  flushing = true
  try {
    while (memoryQueue.length > 0) {
      const next = memoryQueue[0]
      try {
        await rpc(next.fn, next.args)
        lastError = null
      } catch (e) {
        if (e instanceof NetworkError) break
        // The server refused it (e.g. login expired): drop it so the queue can move on, and say so.
        lastError = e instanceof Error ? e.message : 'A saved change could not be sent.'
      }
      save(memoryQueue.filter((w) => w !== next))
    }
  } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush())
  window.setInterval(() => void flush(), 20000)
}

/** Number of changes waiting to be sent, kept up to date. */
export function usePendingWrites(): { pending: number; error: string | null } {
  const [state, setState] = useState({ pending: pendingCount(), error: lastSyncError() })
  useEffect(() => {
    const update = () => setState({ pending: pendingCount(), error: lastSyncError() })
    window.addEventListener(CHANGE_EVENT, update)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    void flush()
    return () => {
      window.removeEventListener(CHANGE_EVENT, update)
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return state
}
