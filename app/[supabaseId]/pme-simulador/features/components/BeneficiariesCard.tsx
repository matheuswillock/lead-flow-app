import { Minus, Users } from "lucide-react";
import { useMemo } from "react";
import { AgeRangeInput } from "@/components/ui/age-range-input";
import { Button } from "@/components/ui/button";
import { deserializeAgeRanges, getTotalBeneficiaries } from "@/lib/ageRanges";
import { cn } from "@/lib/utils";

type BeneficiariesCardProps = {
  serializedAgeRanges: string;
  isLoading: boolean;
  onAgeRangesChange: (serialized: string) => void;
};

export function BeneficiariesCard({
  serializedAgeRanges,
  isLoading,
  onAgeRangesChange,
}: BeneficiariesCardProps) {
  const total = useMemo(
    () => getTotalBeneficiaries(deserializeAgeRanges(serializedAgeRanges)),
    [serializedAgeRanges],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="size-4.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Beneficiários</p>
            <p className="text-xs text-muted-foreground">Informe quantas vidas há em cada faixa etária</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {total > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAgeRangesChange("")}
              disabled={isLoading}
            >
              <Minus data-icon="inline-start" />
              Limpar
            </Button>
          )}
          <span
            className={cn(
              "inline-flex items-baseline gap-1.5 rounded-full border px-3.5 py-1.5",
              "border-primary/30 bg-primary/10",
            )}
          >
            <span className="font-display text-base font-bold tabular-nums text-primary">{total}</span>
            <span className="text-xs font-semibold text-primary">{total === 1 ? "vida" : "vidas"}</span>
          </span>
        </div>
      </div>

      <AgeRangeInput
        value={serializedAgeRanges}
        onChange={onAgeRangesChange}
        disabled={isLoading}
      />
    </div>
  );
}
