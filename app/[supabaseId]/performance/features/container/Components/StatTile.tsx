interface StatTileProps {
  label: string;
  value: string | number;
  suffix?: string;
  sub?: string;
  accent?: string;
  icon?: React.ReactNode;
}

export function StatTile({ label, value, suffix, sub, accent, icon }: StatTileProps) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between text-foreground/55 text-[10.5px] uppercase tracking-wider font-semibold">
        <span>{label}</span>
        {icon}
      </div>
      <div
        className="mt-1.5 font-display text-[22px] font-bold leading-none num"
        style={{ color: accent || "currentColor" }}
      >
        {value}
        {suffix && <span className="text-[11px] text-foreground/55 font-medium ml-0.5">{suffix}</span>}
      </div>
      {sub && <div className="text-[11px] text-foreground/45 mt-1.5">{sub}</div>}
    </div>
  )
}