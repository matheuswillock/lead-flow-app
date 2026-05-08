import { MedalBadge } from "./MedalBadge";
import { PerfBar } from "./PerfBar";

interface RankRowProps {
  rank: number;
  name: string;
  role?: string;
  avatar: string;
  value: number | string;
  suffix?: string;
  secondary?: string;
  pct: number;
  color?: string;
  onClick?: () => void;
}

export function RankRow({ rank, name, role, avatar, value, suffix, secondary, pct, color, onClick }: RankRowProps ) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left grid grid-cols-[28px_1fr_auto] items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-white/[0.035] transition-colors cursor-pointer focus:outline-none focus:bg-white/4"
    >
      <MedalBadge rank={rank} />
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`size-8 rounded-full ${avatar} grid place-items-center text-[11px] font-semibold text-white shrink-0`}
        >
          {name
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium truncate">{name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {role && (
              <span className="text-[10.5px] uppercase tracking-wider font-semibold text-white/55">
                {role}
              </span>
            )}
            {secondary && (
              <span className="text-[10.5px] text-white/40">
                {role ? `· ${secondary}` : secondary}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-display text-[18px] font-bold leading-none num">
          {value}
          {suffix && <span className="text-[11px] text-white/50 font-medium ml-0.5">{suffix}</span>}
        </div>
        <div className="mt-1.5 w-30 ml-auto">
          <PerfBar pct={pct} color={color} />
        </div>
      </div>
    </button>
  )
}
