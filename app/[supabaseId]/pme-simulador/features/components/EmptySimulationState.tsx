import { Building2 } from "lucide-react";

export function EmptySimulationState() {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <Building2 className="size-10 text-muted-foreground/70" />
      <p className="text-sm text-muted-foreground">Adicione ao menos uma idade para simular</p>
    </div>
  );
}

