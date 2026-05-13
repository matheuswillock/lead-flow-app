import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PlanBreakdownGrid } from "./PlanBreakdownGrid";
import type { PmePlanSimulationResult } from "../context/PmeSimulatorTypes";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const OPERATOR_BADGE_STYLES: Record<string, string> = {
  Alice: "bg-[var(--sim-op-alice-bg)] text-[var(--sim-op-alice-fg)]",
  Amil: "bg-[var(--sim-op-amil-bg)] text-[var(--sim-op-amil-fg)]",
  Bradesco: "bg-[var(--sim-op-bradesco-bg)] text-[var(--sim-op-bradesco-fg)]",
  Hapvida: "bg-[var(--sim-op-hapvida-bg)] text-[var(--sim-op-hapvida-fg)]",
  Porto: "bg-[var(--sim-op-porto-bg)] text-[var(--sim-op-porto-fg)]",
  SulAmerica: "bg-[var(--sim-op-sulamerica-bg)] text-[var(--sim-op-sulamerica-fg)]",
  Unimed: "bg-[var(--sim-op-unimed-bg)] text-[var(--sim-op-unimed-fg)]",
};

type PlanResultCardProps = {
  plan: PmePlanSimulationResult;
  lives: number;
  isExpanded: boolean;
  onToggle: (planId: string) => void;
};

export function PlanResultCard({ plan, lives, isExpanded, onToggle }: PlanResultCardProps) {
  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
        onClick={() => onToggle(plan.planId)}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Badge className={cn("rounded-md border-0 text-[11px] uppercase tracking-[0.08em]", OPERATOR_BADGE_STYLES[plan.operator] ?? "bg-muted text-muted-foreground")}>
            {plan.operator}
          </Badge>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-foreground">
              {plan.planName}
              {plan.isBest ? (
                <span className="ml-2 rounded-sm bg-semantic-success-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-semantic-success">
                  Mais barato
                </span>
              ) : null}
            </p>
            <p className="text-sm text-muted-foreground">per capita {currencyFormatter.format(plan.perCapita)}/mes</p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-4xl font-light leading-none tracking-tight text-foreground">
            <span className="text-2xl">{currencyFormatter.format(plan.total)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">/mes · {lives} {lives > 1 ? "vidas" : "vida"}</p>
        </div>
      </button>

      {isExpanded ? (
        <div className="border-t border-border bg-surface-1 px-5 py-4">
          <PlanBreakdownGrid items={plan.breakdown} />
        </div>
      ) : null}
    </article>
  );
}
