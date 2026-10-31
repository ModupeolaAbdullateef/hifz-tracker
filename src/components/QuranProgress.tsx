import { useState } from 'react'
import ProgressRing from './ProgressRing'
import { TOTAL_JUZ, TOTAL_PAGES, juzPageRange, juzProgress, shadeLevel } from '../lib/quran'

interface QuranProgressProps {
  memorised: Set<number>
  /** Optional button(s) shown in the header, e.g. the staff "Edit" button. */
  actions?: React.ReactNode
}

/** Juz-by-juz (or page-by-page) map of how much of the Quran a student has memorised. */
export default function QuranProgress({ memorised, actions }: QuranProgressProps) {
  const [view, setView] = useState<'juz' | 'whole'>('juz')
  const progress = juzProgress(memorised)
  const juzComplete = progress.filter((j) => j.pct === 100).length
  const pages = memorised.size
  const overallPct = Math.round((pages / TOTAL_PAGES) * 1000) / 10

  return (
    <div className="card quran-progress">
      <div className="quran-progress__header">
        <div>
          <h3 className="mt-0 mb-0">Quran memorisation</h3>
          <p className="muted mb-0">
            {pages} of {TOTAL_PAGES} pages · {overallPct}%
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="toggle-group" role="group" aria-label="Memorisation view">
            <button
              type="button"
              data-variant="filter"
              className={view === 'whole' ? 'is-active' : ''}
              aria-pressed={view === 'whole'}
              onClick={() => setView('whole')}
            >
              Whole
            </button>
            <button
              type="button"
              data-variant="filter"
              className={view === 'juz' ? 'is-active' : ''}
              aria-pressed={view === 'juz'}
              onClick={() => setView('juz')}
            >
              By juz
            </button>
          </div>
          {actions}
        </div>
      </div>

      <div className="quran-progress__body">
        {view === 'juz' ? (
          <ProgressRing value={juzComplete} target={TOTAL_JUZ} label="Juz complete" />
        ) : (
          <ProgressRing value={pages} target={TOTAL_PAGES} label="Pages memorised" />
        )}

        {view === 'juz' ? (
          <ul className="juz-grid" aria-label="Memorisation by juz">
            {progress.map((j) => (
              <li
                key={j.juz}
                className={`juz-tile shade-${shadeLevel(j.pct)}`}
                title={`Juz ${j.juz}: ${j.done} of ${j.total} pages`}
              >
                <span className="juz-tile__num">{j.juz}</span>
                <span className="juz-tile__pct">{j.pct === 100 ? '✓' : `${j.pct}%`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="page-map" aria-label="Memorisation page by page">
            {progress.map((j) => {
              const [start, end] = juzPageRange(j.juz)
              const cells = []
              for (let p = start; p <= end; p++) {
                cells.push(
                  <span
                    key={p}
                    className={`page-map__cell${memorised.has(p) ? ' is-done' : ''}`}
                    title={`Page ${p}`}
                  />,
                )
              }
              return (
                <div className="page-map__row" key={j.juz}>
                  <span className="page-map__label">{j.juz}</span>
                  <div className="page-map__cells">{cells}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
