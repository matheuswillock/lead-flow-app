"use client";

import { Heart, Search, X } from "lucide-react";
import { PresetButton } from "./PresetButton";
import { Button } from "@/components/ui/button";
import { DashedFilterButton } from "./DashedFilterButton";
import { Input } from "@/components/ui/input";
import { useState, useCallback } from "react";

interface PerfFiltersBarProps {
  sdrPicks?: string[];
  closerPicks?: string[];
  presets: ["1d", "7d", "15d", "1m", "3m"];
  datePick?: string;
  preset: string;
  onClearAll: () => void;
  setPreset: (preset: string) => void;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function PerfFiltersBar({
  sdrPicks,
  closerPicks,
  presets,
  datePick,
  preset,
  onClearAll,
  setPreset,
  search = "",
  onSearchChange,
}: PerfFiltersBarProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const isFiltered = sdrPicks?.length || closerPicks?.length || datePick || preset !== "7d" || localSearch;

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && onSearchChange) {
        onSearchChange(localSearch);
      }
    },
    [localSearch, onSearchChange]
  );

  const handleSearchBlur = useCallback(() => {
    if (onSearchChange && localSearch !== search) {
      onSearchChange(localSearch);
    }
  }, [localSearch, search, onSearchChange]);

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
      <div className="h-8 inline-flex items-center gap-2 px-2.5 rounded-md border border-border bg-card/40 min-w-50">
        <Search size={13} className="text-white/45" />
        <Input
          placeholder="Buscar cliente..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          onBlur={handleSearchBlur}
          className="h-full bg-transparent border-0 outline-none text-xs placeholder:text-white/40 w-full p-0 shadow-none focus-visible:ring-0"
        />
      </div>

      {/* Presets saved */}
      <Button variant="outline" className="h-8 px-2.5 inline-flex items-center gap-1.5 text-xs rounded-md hover:bg-white/4 text-white/85">
        <Heart size={13} className="text-white/60" /> Presets
      </Button>

      {/* Clear */}
      {isFiltered && (
        <Button
          variant="ghost"
          onClick={() => {
            setLocalSearch("");
            onClearAll();
          }}
          className="h-8 px-2 inline-flex items-center gap-1 text-xs text-white/70 hover:text-white hover:bg-transparent"
        >
          <X size={13} /> Limpar
        </Button>
      )}
    </div>
  );
}
