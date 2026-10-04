import { badgeLabel } from '../lib/badges'
import type { Badge } from '../lib/types'

export default function BadgeRow({ badges }: { badges: Badge[] }) {
  if (badges.length === 0) {
    return <p className="muted">No badges yet — keep going!</p>
  }
  return (
    <div className="badge-row">
      {badges.map((b) => (
        <span className="badge-pill" key={b.badge_key}>
          🏅 {badgeLabel(b.badge_key)}
        </span>
      ))}
    </div>
  )
}
