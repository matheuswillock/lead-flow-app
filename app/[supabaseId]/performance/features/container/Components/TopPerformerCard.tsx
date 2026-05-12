import { Crown } from "lucide-react";

interface TopPerformerCardProps {
  title: string;
  subtitle: string;
  name: string;
  role: string;
  avatar: string;
  value: number | string;
  suffix?: string;
  helper?: string;
  accent?: "primary" | "info";
}

export function TopPerformerCard({ title, subtitle, name, role, avatar, value, suffix, helper, accent }: TopPerformerCardProps) {
  const c = {
    primary: { glow: "var(--primary)", text: "text-[var(--primary)]" },
    info: { glow: "var(--info)", text: "text-[var(--info)]" },
  }[accent || "primary"]
  return (
    <div className="relative rounded-xl border border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-card overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: `radial-gradient(120% 110% at 100% 0%, color-mix(in oklab, ${c.glow} 22%, transparent) 0%, transparent 60%)`,
        }}
      ></div>
      <div className="relative p-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown size={14} className={c.text} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/65">
            {title}
          </span>
        </div>
        <span className="text-[10.5px] text-foreground/40">{subtitle}</span>
      </div>
      <div className="relative px-4 pb-4 flex items-center gap-3">
        <div
          className={`size-12 rounded-full ${avatar} grid place-items-center text-[14px] font-semibold text-white shrink-0`}
        >
          {name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-[17px] font-bold truncate">{name}</div>
          <div className="text-[11px] text-foreground/50">{role}</div>
        </div>
        <div className="text-right">
          <div className="font-display text-[26px] font-bold leading-none num">
            {value}
            <span className="text-[12px] text-foreground/55 font-medium ml-0.5">{suffix}</span>
          </div>
          <div className="text-[11px] text-foreground/45 mt-1">{helper}</div>
        </div>
      </div>
    </div>
  )
}
