import { Delta } from "./Delta";
import { Sparkline } from "./Sparkline";

interface KpiCardProps {
  icon: React.ComponentType<{ size: number; style?: React.CSSProperties }>;
  label: string;
  value: number | string;
  suffix?: string;
  helper?: string;
  delta?: number;
  deltaInverse?: boolean;
  sparkValues: number[];
  sparkColor?: string;
  accent?: "primary" | "info" | "success" | "danger" | "warn";
  featured?: boolean;
}

export function KpiCard({
  icon: Ic,
  label,
  value,
  suffix,
  helper,
  delta,
  deltaInverse,
  sparkColor,
  sparkValues,
  accent = "primary",
  featured = false,
}: KpiCardProps) {
  const accentMap = {
    primary: {
      ring: "color-mix(in oklab, var(--primary) 40%, transparent)",
      glow: "var(--primary)",
      icon: "var(--primary)",
    },
    info: {
      ring: "color-mix(in oklab, var(--info) 40%, transparent)",
      glow: "var(--info)",
      icon: "var(--info)",
    },
    success: {
      ring: "color-mix(in oklab, var(--success) 40%, transparent)",
      glow: "var(--success)",
      icon: "var(--success)",
    },
    danger: {
      ring: "color-mix(in oklab, var(--danger) 40%, transparent)",
      glow: "var(--danger)",
      icon: "var(--danger)",
    },
    warn: {
      ring: "color-mix(in oklab, var(--warn) 40%, transparent)",
      glow: "var(--warn)",
      icon: "var(--warn)",
    },
  }[accent]

  return (
    <div
      className={`relative rounded-xl border ${featured ? "border-[color-mix(in_oklab,var(--primary)_30%,var(--border))]" : "border-border"} bg-card overflow-hidden`}
    >
      {featured && (
        <div className="absolute inset-0 pointer-events-none glow-primary opacity-60"></div>
      )}

      <div className="relative p-5 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className="size-8 rounded-lg grid place-items-center"
            style={{
              background: `color-mix(in oklab, ${accentMap.glow} 14%, var(--card-2))`,
              border: `1px solid color-mix(in oklab, ${accentMap.glow} 24%, transparent)`,
            }}
          >
            <Ic size={15} style={{ color: accentMap.icon }} />
          </div>
          <div className="text-[12.5px] font-medium text-white/70">{label}</div>
        </div>
        {delta !== undefined && <Delta value={delta} inverse={deltaInverse} />}
      </div>

      <div className="relative px-5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-[34px] leading-none font-bold tracking-tight num">
            {value}
          </span>
          {suffix && <span className="text-base text-white/55 font-medium num">{suffix}</span>}
        </div>
        {helper && <div className="mt-1.5 text-[11.5px] text-white/45">{helper}</div>}
      </div>

      <div className="relative mt-3 px-1 pb-1">
        <Sparkline values={sparkValues} color={accentMap.glow} />
      </div>
    </div>
  )
}
