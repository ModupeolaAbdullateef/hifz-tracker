import { useEffect, useMemo, useState } from 'react'
import type { Tip } from '../lib/types'

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function categoryLabel(category: Tip['category']): string {
  if (category === 'technique') return 'Technique'
  if (category === 'schedule') return 'Schedule'
  return 'Announcement'
}

export default function TipsMarquee({ tips }: { tips: Tip[] }) {
  const shuffled = useMemo(() => shuffle(tips), [tips])
  const [reducedMotion, setReducedMotion] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const listener = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (!reducedMotion || shuffled.length === 0) return
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % shuffled.length)
    }, 4500)
    return () => window.clearInterval(id)
  }, [reducedMotion, shuffled.length])

  if (shuffled.length === 0) return null

  if (reducedMotion) {
    const tip = shuffled[activeIndex % shuffled.length]
    return (
      <div className="tips-marquee" role="region" aria-label="Tips">
        <div className="tips-fade" key={tip.id}>
          <span className={`tips-marquee__tag tips-marquee__tag--${tip.category}`}>
            {categoryLabel(tip.category)}
          </span>{' '}
          {tip.text}
        </div>
      </div>
    )
  }

  const doubled = [...shuffled, ...shuffled]

  return (
    <div className="tips-marquee" role="region" aria-label="Tips" tabIndex={0}>
      <div className="tips-marquee__track">
        {doubled.map((tip, i) => (
          <div className="tips-marquee__item" key={`${tip.id}-${i}`}>
            <span className={`tips-marquee__tag tips-marquee__tag--${tip.category}`}>
              {categoryLabel(tip.category)}
            </span>
            <span>{tip.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
