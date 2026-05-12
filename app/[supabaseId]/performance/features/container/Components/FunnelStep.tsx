import { PerfBar } from "./PerfBar";

interface FunnelStepProps {
  label: string;
  value: number;
  pct: number;
  color: string;
}

export function FunnelStep({ label, value, pct, color }: FunnelStepProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] mb-1">
        <span className="text-foreground/75">{label}</span>
        <span className="num text-foreground/85 font-semibold">
          {value} <span className="text-foreground/40">· {pct}%</span>
        </span>
      </div>
      <PerfBar pct={pct} color={color} />
    </div>
  )
}