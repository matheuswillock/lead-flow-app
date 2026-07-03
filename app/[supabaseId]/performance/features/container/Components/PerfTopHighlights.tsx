"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TopPerformerCard } from "./TopPerformerCard";
import { usePerformanceContext } from "../../context/PerformanceContext";

function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1).replace(".", ",")}M em receita`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}k em receita`;
  return `R$ ${value.toFixed(0)} em receita`;
}

export function PerfTopHighlights() {
  const { data, isLoading } = usePerformanceContext();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-30 rounded-xl" />
        ))}
      </div>
    );
  }

  const { highlights } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {highlights.topCloser && (
        <TopPerformerCard
          title="Top Closer do mês"
          subtitle="Atualizado agora"
          name={highlights.topCloser.name}
          role={`Closer`}
          avatar="avatar-1"
          value={String(highlights.topCloser.value)}
          suffix="vendas"
          helper={formatCurrencyShort(highlights.topCloser.totalSalesValue)}
          accent="primary"
        />
      )}

      {highlights.topSdr && (
        <TopPerformerCard
          title="Top SDR do mês"
          subtitle="Atualizado agora"
          name={highlights.topSdr.name}
          role={`SDR`}
          avatar="avatar-2"
          value={String(highlights.topSdr.value)}
          suffix="agend."
          helper={`${highlights.topSdr.attendanceRate.toFixed(0)}% taxa de presença`}
          accent="info"
        />
      )}

      {!highlights.topCloser && !highlights.topSdr && (
        <div className="col-span-2 text-center text-foreground/40 text-sm py-6">
          Nenhum destaque disponível para o período selecionado
        </div>
      )}
    </div>
  );
}
