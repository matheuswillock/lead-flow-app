import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PmeHospitalOption } from "../context/PmeSimulatorTypes";

type HospitalOptionCardProps = {
  option: PmeHospitalOption;
  isActive: boolean;
  onSelect: (hospitalId: PmeHospitalOption["id"]) => void;
};

export function HospitalOptionCard({ option, isActive, onSelect }: HospitalOptionCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      className={cn(
        "flex min-h-24 w-full flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors",
        isActive
          ? "border-primary bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))]"
          : "border-border bg-card hover:border-primary/60",
      )}
    >
      <span className="text-sm font-semibold text-foreground">{option.label}</span>
      <span className="text-xs text-muted-foreground">{option.sub}</span>
      <span
        className={cn(
          "mt-2 inline-flex size-4 items-center justify-center rounded-full border",
          isActive ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent",
        )}
      >
        <Check className="size-3" />
      </span>
    </button>
  );
}

