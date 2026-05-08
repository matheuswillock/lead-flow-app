interface MedalBadgeProps {
  rank: number;
}

export function MedalBadge({ rank }: MedalBadgeProps) {
  if (rank > 3 || rank < 1) return <span className="text-[12px] text-white/45 num w-6 text-center">{rank}</span>
  const colors = {
    1: { bg: "linear-gradient(135deg,#FFD56B,#FF8A00)", ring: "rgba(255,180,60,0.35)" },
    2: { bg: "linear-gradient(135deg,#E5E5E5,#A0A0A0)", ring: "rgba(220,220,220,0.25)" },
    3: { bg: "linear-gradient(135deg,#E08A55,#8A4A22)", ring: "rgba(220,140,80,0.3)" },
  }[rank]!
  
  return (
    <div
      className="size-6 rounded-full grid place-items-center text-[10.5px] font-bold text-black/80"
      style={{ background: colors.bg, boxShadow: `0 0 0 3px ${colors.ring}` }}
    >
      {rank}
    </div>
  )
}
