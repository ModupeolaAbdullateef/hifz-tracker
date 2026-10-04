interface BarChartProps {
  data: { label: string; value: number }[]
  unit?: string
}

export default function BarChart({ data, unit }: BarChartProps) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const width = 320
  const height = 140
  const barGap = 6
  const barWidth = data.length > 0 ? width / data.length - barGap : 0

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height + 24}`}
      role="img"
      aria-label={`New Hifz pages per week${unit ? ` in ${unit}` : ''}`}
    >
      {data.map((d, i) => {
        const barHeight = (d.value / max) * height
        const x = i * (barWidth + barGap)
        const y = height - barHeight
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={Math.max(barWidth, 2)}
              height={Math.max(barHeight, 1)}
              rx={3}
              fill="var(--brand-primary)"
            />
            <text x={x + barWidth / 2} y={height + 16} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
