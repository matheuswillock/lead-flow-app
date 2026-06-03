"use client";

import { Minus, Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AGE_RANGES,
  deserializeAgeRanges,
  serializeAgeRanges,
  getTotalBeneficiaries,
  type AgeRangeCount,
} from "@/lib/ageRanges";

interface AgeRangeInputProps {
  value: string;
  onChange: (serialized: string) => void;
  disabled?: boolean;
  className?: string;
}

export function AgeRangeInput({
  value,
  onChange,
  disabled = false,
  className,
}: AgeRangeInputProps) {
  const entries = useMemo(() => deserializeAgeRanges(value), [value]);

  const countMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      map.set(entry.rangeKey, entry.count);
    }
    return map;
  }, [entries]);

  const updateCount = useCallback(
    (rangeKey: string, delta: number) => {
      const current = countMap.get(rangeKey) ?? 0;
      const next = Math.max(0, current + delta);

      const updated: AgeRangeCount[] = AGE_RANGES.map((range) => ({
        rangeKey: range.rangeKey,
        count: range.rangeKey === rangeKey ? next : (countMap.get(range.rangeKey) ?? 0),
      })).filter((e) => e.count > 0);

      onChange(serializeAgeRanges(updated));
    },
    [countMap, onChange]
  );

  const total = useMemo(() => getTotalBeneficiaries(entries), [entries]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {AGE_RANGES.map((range) => {
          const count = countMap.get(range.rangeKey) ?? 0;
          const filled = count > 0;
          return (
            <div
              key={range.rangeKey}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border p-3.5 transition-colors",
                filled
                  ? "border-primary/50 bg-primary/8"
                  : "border-border bg-muted/30"
              )}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={cn(
                    "text-sm font-semibold leading-none",
                    filled ? "text-primary" : "text-foreground"
                  )}
                >
                  {range.label}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Anos
                </span>
              </div>

              <div className="flex items-center justify-between gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 rounded-xl"
                  disabled={disabled || count <= 0}
                  onClick={() => updateCount(range.rangeKey, -1)}
                  aria-label={`Diminuir ${range.label}`}
                >
                  <Minus />
                </Button>
                <span
                  className={cn(
                    "min-w-6 text-center text-xl font-bold tabular-nums leading-none",
                    filled ? "text-primary" : "text-muted-foreground/40"
                  )}
                >
                  {count}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0 rounded-xl"
                  disabled={disabled}
                  onClick={() => updateCount(range.rangeKey, 1)}
                  aria-label={`Aumentar ${range.label}`}
                >
                  <Plus />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {total > 0 && (
        <p className="text-xs text-muted-foreground">
          Total: {total} {total === 1 ? "beneficiário" : "beneficiários"}
        </p>
      )}
    </div>
  );
}
