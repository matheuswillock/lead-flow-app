interface SparklineProps {
  values: number[]
  color: string
  height?: number
  fill?: boolean
}

export function Sparkline ({ values, color = "var(--primary)", height = 36, fill = true }: SparklineProps) {
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const W = 120
  const H = height
  const step = W / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(H - ((v - min) / range) * (H - 6) - 3).toFixed(1)}`)
    .join(" ")
  const area = `0,${H} ${points} ${W},${H}`
  return (
    <svg 
      viewBox={`0 0 ${W} ${H}`} 
      preserveAspectRatio="none" 
      className="w-full" 
      style={{ height }}
    >
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && (
        <polyline
          points={area}
          fill={`url(#grad-${color.replace(/[^a-z0-9]/gi, "")})`}
          stroke="none"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}