import { Skeleton } from "@/components/ui/skeleton";
import { EmptySimulationState } from "./EmptySimulationState";
import { PlanResultCard } from "./PlanResultCard";
import type { PmeSimulationOutput } from "../context/PmeSimulatorTypes";

type SimulationResultsProps = {
  agesCount: number;
  simulation: PmeSimulationOutput | null;
  isLoading: boolean;
  expandedPlanIds: string[];
  onTogglePlan: (planId: string) => void;
};

export function SimulationResults({
  agesCount,
  simulation,
  isLoading,
  expandedPlanIds,
  onTogglePlan,
}: SimulationResultsProps) {
  if (agesCount === 0) {
    return <EmptySimulationState />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-64 rounded" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (!simulation || simulation.results.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
        Nenhum plano disponível para esta combinação.
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-semibold text-foreground">
          {simulation.hospitalId === "nenhum" ? "Sem hospital de referência" : `Com ${simulation.hospitalLabel}`}
        </h2>
        <span className="text-sm text-muted-foreground">
          {simulation.lives} {simulation.lives > 1 ? "vidas" : "vida"} · ordenado por menor custo
        </span>
      </header>

      {simulation.results.map((plan) => (
        <PlanResultCard
          key={plan.planId}
          plan={plan}
          lives={simulation.lives}
          isExpanded={expandedPlanIds.includes(plan.planId)}
          onToggle={onTogglePlan}
        />
      ))}
    </section>
  );
}

