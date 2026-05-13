import type { PmePlanBreakdownItem } from "../context/PmeSimulatorTypes";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type PlanBreakdownGridProps = {
  items: PmePlanBreakdownItem[];
};

export function PlanBreakdownGrid({ items }: PlanBreakdownGridProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.ageRangeLabel} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-xs text-muted-foreground">{item.ageRangeLabel} anos</span>
            <span className="text-xs text-foreground">
              <span className="mr-1 text-primary">{item.quantity}x</span>
              <strong>{currencyFormatter.format(item.subtotal)}</strong>
            </span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Valor unitario por faixa:{" "}
        {items.map((item) => `${item.ageRangeLabel}a -> ${currencyFormatter.format(item.unitPrice)}`).join(" · ")}
      </p>
    </div>
  );
}

