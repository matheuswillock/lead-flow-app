interface PerfBarProps {
  pct: number
  color?: string
}

export function PerfBar({ pct, color = "var(--primary)" }: PerfBarProps) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/6 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      ></div>
    </div>
  )
}
