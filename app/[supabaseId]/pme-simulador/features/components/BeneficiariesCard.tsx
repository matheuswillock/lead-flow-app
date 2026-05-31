import { Card, CardContent } from "@/components/ui/card";
import { AgeRangeInput } from "@/components/ui/age-range-input";

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
  return (
    <Card className="rounded-2xl border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Beneficiários
        </span>
        <AgeRangeInput
          value={serializedAgeRanges}
          onChange={onAgeRangesChange}
          disabled={isLoading}
        />
      </CardContent>
    </Card>
  );
}

