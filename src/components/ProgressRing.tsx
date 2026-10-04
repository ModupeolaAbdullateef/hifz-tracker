interface ProgressRingProps {
  value: number
  target: number
  label: string
}

export default function ProgressRing({ value, target, label }: ProgressRingProps) {
  const size = 140
  const stroke = 14
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const pct = target > 0 ? Math.min(1, value / target) : 0
  const offset = circumference * (1 - pct)

  return (
    <div className="progress-ring">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${value} of ${target}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-subtle)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--brand-secondary)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x="50%" y="46%" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--brand-primary-dark)">
          {value}
        </text>
        <text x="50%" y="64%" textAnchor="middle" fontSize="12" fill="var(--text-muted)">
          of {target}
        </text>
      </svg>
      <div className="progress-ring__label">{label}</div>
    </div>
  )
}
