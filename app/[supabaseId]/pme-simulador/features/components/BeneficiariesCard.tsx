import { Card, CardContent } from "@/components/ui/card";
import { AgeTagsInput } from "./AgeTagsInput";

type BeneficiariesCardProps = {
  ages: number[];
  ageInput: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onAddAges: () => void;
  onRemoveAge: (index: number) => void;
  onClearAges: () => void;
};

export function BeneficiariesCard(props: BeneficiariesCardProps) {
  return (
    <Card className="rounded-2xl border-border bg-card">
      <CardContent className="flex flex-col gap-4 p-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Beneficiarios
        </span>
        <AgeTagsInput {...props} />
      </CardContent>
    </Card>
  );
}

