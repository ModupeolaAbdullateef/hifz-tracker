import { useState } from 'react'
import { ErrorBanner } from './LoadingAndEmpty'
import {
  TOTAL_PAGES,
  juzOfPage,
  juzPageRange,
  juzProgress,
  pageRange,
  shadeLevel,
  surahsInJuz,
  type Surah,
} from '../lib/quran'

interface PriorHifzEditorProps {
  studentLabel: string
  initialPages: number[]
  onClose: () => void
  onSave: (pages: number[]) => Promise<void>
}

/** Staff sheet for marking what a student had already memorised when they joined. */
export default function PriorHifzEditor({ studentLabel, initialPages, onClose, onSave }: PriorHifzEditorProps) {
  const [pages, setPages] = useState<Set<number>>(() => new Set(initialPages))
  const [openJuz, setOpenJuz] = useState<number | null>(() =>
    initialPages.length ? juzOfPage(Math.max(...initialPages)) : 30,
  )
  const [rangeFrom, setRangeFrom] = useState('')
  const [rangeTo, setRangeTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const progress = juzProgress(pages)

  function setMany(list: number[], on: boolean) {
    setPages((prev) => {
      const next = new Set(prev)
      for (const p of list) {
        if (on) next.add(p)
        else next.delete(p)
      }
      return next
    })
  }

  function surahPages(s: Surah) {
    return pageRange(s.startPage, s.endPage)
  }

  function applyRange(on: boolean) {
    const from = Number(rangeFrom || rangeTo)
    const to = Number(rangeTo || rangeFrom)
    if (!from || from < 1 || to > TOTAL_PAGES || from > to) {
      setError(`Enter pages between 1 and ${TOTAL_PAGES}, with "from" before "to".`)
      return
    }
    setError(null)
    setMany(pageRange(from, to), on)
    setRangeFrom('')
    setRangeTo('')
  }

  async function handleSave() {
    setBusy(true)
    setError(null)
    try {
      await onSave([...pages].sort((a, b) => a - b))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setBusy(false)
    }
  }

  const openRange = openJuz ? juzPageRange(openJuz) : null

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet sheet--wide" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__header">
          <h3 className="mt-0 mb-0">{studentLabel} · Hifz before joining</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="field-hint">
          Mark what they had already memorised when they joined. Pages entered in weekly records are added on top
          automatically, so you don't need to mark those here. {pages.size} page{pages.size === 1 ? '' : 's'}{' '}
          marked.
        </p>

        <div className="field">
          <label htmlFor="range-from">Mark a page range</label>
          <div className="page-range-inputs">
            <input
              id="range-from"
              type="number"
              inputMode="numeric"
              min={1}
              max={TOTAL_PAGES}
              placeholder="From"
              aria-label="From page"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
            />
            <span aria-hidden="true">to</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={TOTAL_PAGES}
              placeholder="To"
              aria-label="To page"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
            />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyRange(true)}>
              Add
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => applyRange(false)}>
              Remove
            </button>
          </div>
        </div>

        <p className="field-hint mb-0">Or tap a juz to mark whole juz, surahs or single pages:</p>
        <ul className="juz-grid juz-grid--compact" aria-label="Choose a juz">
          {progress.map((j) => (
            <li key={j.juz}>
              <button
                type="button"
                className={`juz-tile shade-${shadeLevel(j.pct)}${openJuz === j.juz ? ' is-open' : ''}`}
                aria-pressed={openJuz === j.juz}
                onClick={() => setOpenJuz(j.juz)}
              >
                <span className="juz-tile__num">{j.juz}</span>
                <span className="juz-tile__pct">{j.pct === 100 ? '✓' : `${j.pct}%`}</span>
              </button>
            </li>
          ))}
        </ul>

        {openJuz && openRange && (
          <div className="juz-detail">
            <div className="flex-between">
              <strong>
                Juz {openJuz} · pages {openRange[0]}–{openRange[1]}
              </strong>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setMany(pageRange(openRange[0], openRange[1]), true)}
                >
                  Whole juz
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setMany(pageRange(openRange[0], openRange[1]), false)}
                >
                  Clear juz
                </button>
              </div>
            </div>

            <div className="surah-checks">
              {surahsInJuz(openJuz).map((s) => {
                const sp = surahPages(s)
                const all = sp.every((p) => pages.has(p))
                return (
                  <label key={s.number} className="surah-check">
                    <input type="checkbox" checked={all} onChange={(e) => setMany(sp, e.target.checked)} />
                    <span>
                      {s.number}. {s.name}{' '}
                      <span className="muted">
                        (p{s.startPage}
                        {s.endPage > s.startPage ? `–${s.endPage}` : ''})
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="page-chips" aria-label={`Pages in juz ${openJuz}`}>
              {pageRange(openRange[0], openRange[1]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`page-chip${pages.has(p) ? ' is-done' : ''}`}
                  aria-pressed={pages.has(p)}
                  onClick={() => setMany([p], !pages.has(p))}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <ErrorBanner text={error} />}

        <div className="flex gap-2 flex-wrap" style={{ marginTop: 'var(--space-4)' }}>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
