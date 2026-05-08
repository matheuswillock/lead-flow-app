import { Button } from "@/components/ui/button";
import { Calendar, CirclePlus, X } from "lucide-react";

interface DashedFilterButtonProps {
  label: string;
  count: number;
  picks?: any[],
  onClear?: () => void
  calendar?: boolean
}

export function DashedFilterButton({
  label,
  count,
  picks,
  onClear,
  calendar,
}: DashedFilterButtonProps) {
  return (
    <div
      className={`h-8 inline-flex items-center text-xs rounded-md border chip-dashed border-(--border-strong) hover:bg-white/4 transition-colors ${count ? "" : ""}`}
    >
      <Button className="px-2.5 h-full inline-flex items-center gap-1.5 text-white/85">
        {calendar ? (
          <Calendar size={14} className="text-white/60" />
        ) : (
          <CirclePlus size={14} className="text-white/60" />
        )}
        <span>{label}</span>
      </Button>
      {count > 0 && (
        <>
          <span className="h-4 w-px bg-white/15"></span>
          <div className="px-2 h-full inline-flex items-center gap-1">
            {picks && picks.length <= 2 ? (
              picks.map((p, i) => (
                <span
                  key={i}
                  className="rounded-sm bg-white/8 text-white px-1.5 py-0.5 text-[10.5px] font-medium"
                >
                  {p}
                </span>
              ))
            ) : (
              <span className="rounded-sm bg-white/8 text-white px-1.5 py-0.5 text-[10.5px] font-medium">
                {count} selecionados
              </span>
            )}
            {onClear && (
              <Button
                onClick={onClear}
                className="ml-0.5 size-4 grid place-items-center text-white/50 hover:text-white"
              >
                <X size={10} />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}