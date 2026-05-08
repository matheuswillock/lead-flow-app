import { Heart, Search, X } from "lucide-react";
import { PresetButton } from "./PresetButton";
import { Button } from "@/components/ui/button";
import { DashedFilterButton } from "./DashedFilterButton";
import { Input } from "@/components/ui/input";

interface PerfFiltersBarProps {
  sdrPicks?: any[]
  closerPicks?: any[]
  presets: ["1d", "7d", "15d", "1m", "3m"]
  datePick?: any
  preset: string
  onClearAll: () => void
  setPreset: (preset: string) => void
}

export function PerfFiltersBar({
  sdrPicks,
  closerPicks,
  presets,
  datePick,
  preset,
  onClearAll,
  setPreset
}: PerfFiltersBarProps) {
  const isFiltered = sdrPicks?.length || closerPicks?.length || datePick || preset !== "7d"
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Period presets */}
      <div className="flex items-center gap-1.5 p-1 rounded-lg border border-border bg-card/50">
        {presets.map((p) => (
          <PresetButton key={p} label={p} active={preset === p} onClick={() => setPreset(p)} />
        ))}
      </div>

      {/* Custom date range */}
      <DashedFilterButton
        calendar
        label="Período"
        count={datePick ? 1 : 0}
        picks={datePick ? [datePick] : []}
      />

      {/* SDR */}
      <DashedFilterButton label="SDR" count={sdrPicks?.length || 0} picks={sdrPicks} />

      {/* Closer */}
      <DashedFilterButton label="Closer" count={closerPicks?.length || 0} picks={closerPicks} />

      {/* Search */}
      <div className="h-8 inline-flex items-center gap-2 px-2.5 rounded-md border border-border bg-(--card)/40 min-w-50">
        <Search size={13} className="text-white/45" />
        <Input
          placeholder="Buscar cliente..."
          className="bg-transparent outline-none text-xs placeholder:text-white/40 w-full"
        />
      </div>

      {/* Presets saved */}
      <Button className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs rounded-md border border-border hover:bg-white/4 text-white/85">
        <Heart size={13} className="text-white/60" /> Presets
      </Button>

      {/* Clear */}
      {isFiltered && (
        <Button
          onClick={onClearAll}
          className="h-8 px-2 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
        >
          <X size={13} /> Limpar
        </Button>
      )}
    </div>
  )
}