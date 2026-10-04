import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { EmptyState } from './LoadingAndEmpty'

export default function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <EmptyState text="This section is for admins only." />
  }
  return <>{children}</>
}
