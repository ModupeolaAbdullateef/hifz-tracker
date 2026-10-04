import { useEffect, useRef, useState } from 'react'
import AdminGuard from '../../components/AdminGuard'
import { ErrorBanner, LoadingState, SuccessBanner } from '../../components/LoadingAndEmpty'
import { deleteResourceMeta, getResourcesAdmin, upsertResourceMeta } from '../../lib/api'
import { adminStorageClient, RESOURCES_BUCKET } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { formatFileSize } from '../../lib/format'
import type { Resource } from '../../lib/types'

const MAX_SIZE_BYTES = 20 * 1024 * 1024

export default function Docs() {
  const { session } = useAuth()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    if (!session) return
    setLoading(true)
    try {
      const rows = await getResourcesAdmin(session.token)
      setResources(rows.sort((a, b) => a.sort_order - b.sort_order))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load documents.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!session) return
    const file = fileInputRef.current?.files?.[0]
    if (!file) {
      setError('Choose a file to upload.')
      return
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError(`File is too large — the limit is ${formatFileSize(MAX_SIZE_BYTES)}.`)
      return
    }

    setUploading(true)
    setError(null)
    setMessage(null)
    try {
      const storagePath = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const storage = adminStorageClient(session.token)
      const { error: uploadError } = await storage.storage.from(RESOURCES_BUCKET).upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      })
      if (uploadError) throw new Error(uploadError.message)

      await upsertResourceMeta(session.token, {
        title: title.trim() || file.name,
        description: description.trim() ? description.trim() : null,
        storagePath,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
        sortOrder: resources.length,
        active: true,
      })

      setMessage('Document uploaded.')
      setTitle('')
      setDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload this document.')
    } finally {
      setUploading(false)
    }
  }

  async function toggleActive(r: Resource) {
    if (!session) return
    await upsertResourceMeta(session.token, {
      id: r.id,
      title: r.title,
      description: r.description,
      storagePath: r.storage_path,
      fileName: r.file_name,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes ?? 0,
      sortOrder: r.sort_order,
      active: !r.active,
    })
    await load()
  }

  async function handleDelete(r: Resource) {
    if (!session) return
    try {
      const storagePath = await deleteResourceMeta(session.token, r.id)
      if (storagePath) {
        const storage = adminStorageClient(session.token)
        await storage.storage.from(RESOURCES_BUCKET).remove([storagePath])
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this document.')
    }
  }

  return (
    <AdminGuard>
      <div className="card">
        <h2 className="mt-0">Upload a document</h2>
        <form onSubmit={handleUpload}>
          <div className="field">
            <label htmlFor="doc-title">Title</label>
            <input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Class induction pack"
            />
          </div>
          <div className="field">
            <label htmlFor="doc-description">Description (optional)</label>
            <textarea id="doc-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="doc-file">File</label>
            <input id="doc-file" type="file" ref={fileInputRef} />
            <p className="field-hint">PDF, Word doc, image, or text file — up to {formatFileSize(MAX_SIZE_BYTES)}.</p>
          </div>
          {error && <ErrorBanner text={error} />}
          {message && <SuccessBanner text={message} />}
          <button type="submit" className="btn btn-primary" disabled={uploading}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="mt-0">Documents</h3>
        {loading ? (
          <LoadingState />
        ) : (
          <ul className="search-results">
            {resources.map((r) => (
              <li key={r.id}>
                <div className="flex-between" style={{ padding: '0.75rem 1rem' }}>
                  <div>
                    <strong>{r.title}</strong>
                    <div className="muted">
                      {r.file_name}
                      {r.size_bytes !== null ? ` · ${formatFileSize(r.size_bytes)}` : ''}
                      {!r.active ? ' · Inactive' : ''}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(r)}>
                      {r.active ? 'Deactivate' : 'Reactivate'}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)}>
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminGuard>
  )
}
