interface ModalSparklineProps {
  data: number[];
  color: string;
}

export function ModalSparkline({ data, color }: ModalSparklineProps) {
  const w = 360,
    h = 64,
    pad = 4
  const max = Math.max(...data),
    min = Math.min(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (data.length - 1)
    const y = h - pad - ((v - min) / span) * (h - pad * 2)
    return [x, y]
  })
  const d = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(" ")
  const area = `${d} L${w - pad},${h - pad} L${pad},${h - pad} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16">
      <defs>
        <linearGradient id={`g-${color.replace(/[^a-z]/gi, "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#g-${color.replace(/[^a-z]/gi, "")})`} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}