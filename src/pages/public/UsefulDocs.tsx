import { useEffect, useState } from 'react'
import SiteHeader from '../../components/SiteHeader'
import PublicNav from '../../components/PublicNav'
import TipsMarquee from '../../components/TipsMarquee'
import { EmptyState, ErrorBanner, LoadingState } from '../../components/LoadingAndEmpty'
import { getActiveResources, getActiveTips } from '../../lib/api'
import { resourcePublicUrl } from '../../lib/supabase'
import { formatFileSize } from '../../lib/format'
import type { Resource, Tip } from '../../lib/types'

export default function UsefulDocs() {
  const [resources, setResources] = useState<Resource[]>([])
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getActiveTips().then(setTips).catch(() => setTips([]))
    getActiveResources()
      .then(setResources)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load documents.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="app-shell">
      <SiteHeader />
      <TipsMarquee tips={tips} />
      <main className="page page--narrow">
        <PublicNav />
        <div className="card">
          <h2>Useful Docs</h2>
          <p className="muted">Induction material and other useful documents for the class.</p>

          {loading && <LoadingState />}
          {error && <ErrorBanner text={error} />}
          {!loading && !error && resources.length === 0 && (
            <EmptyState text="No documents have been added yet." />
          )}

          {!loading && resources.length > 0 && (
            <ul className="doc-list">
              {resources.map((r) => (
                <li key={r.id} className="doc-list__item">
                  <div>
                    <div className="doc-list__title">{r.title}</div>
                    {r.description && <div className="muted">{r.description}</div>}
                    <div className="doc-list__meta">
                      {r.file_name}
                      {r.size_bytes !== null ? ` · ${formatFileSize(r.size_bytes)}` : ''}
                    </div>
                  </div>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={resourcePublicUrl(r.storage_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
      <footer className="site-footer">Hifz Class</footer>
    </div>
  )
}
