interface PerfBarProps {
  pct: number
  color?: string
}

export function PerfBar({ pct, color = "var(--primary)" }: PerfBarProps) {
  return (
    <div className="h-1.5 w-full rounded-full bg-foreground/[0.06] overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      ></div>
    </div>
  )
}
