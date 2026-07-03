"use client";

import { Calendar, Handshake, Target, UserX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "./KpiCard";
import { usePerformanceContext } from "../../context/PerformanceContext";

export function PerfKpis({ density = "comfortable" }) {
  const { data, isLoading } = usePerformanceContext();

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[180px] rounded-xl" />
        ))}
      </div>
    );
  }

  const { kpis } = data;

  function formatCurrency(value: number): string {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(3).replace('.', '.')} em receita`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k em receita`;
    return `R$ ${value.toFixed(2)} em receita`;
  }

  const totalSalesValue = data.rankings.closer.reduce((sum, r) => sum + r.totalSalesValue, 0);
  const avgPerDay = kpis.scheduledLeads > 0 ? (kpis.scheduledLeads / 7).toFixed(1) : "0";

  const cards = [
    {
      icon: Handshake,
      label: "Vendas fechadas",
      value: String(kpis.closedSales),
      helper: formatCurrency(totalSalesValue),
      delta: kpis.closedSalesDelta,
      accent: "primary" as const,
      featured: true,
      sparkValues: kpis.closedSalesSparkline.map((p) => p.value),
    },
    {
      icon: Target,
      label: "Reuniões realizadas",
      value: String(kpis.meetingsHeld),
      helper: `de ${kpis.scheduledLeads} agendadas`,
      delta: kpis.meetingsHeldDelta,
      accent: "info" as const,
      sparkValues: kpis.meetingsHeldSparkline.map((p) => p.value),
    },
    {
      icon: Calendar,
      label: "Agendamentos realizados",
      value: String(kpis.scheduledLeads),
      helper: `média ${avgPerDay}/dia`,
      delta: kpis.scheduledLeadsDelta,
      accent: "success" as const,
      sparkValues: kpis.scheduledLeadsSparkline.map((p) => p.value),
    },
    {
      icon: UserX,
      label: "Taxa de no-show",
      value: kpis.noShowRate.toFixed(1).replace(".", ","),
      suffix: "%",
      helper: `${kpis.noShowCount} reuniões perdidas`,
      delta: kpis.noShowRateDelta,
      deltaInverse: true,
      accent: "warn" as const,
      sparkValues: kpis.noShowRateSparkline.map((p) => p.value),
    },
  ];

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${density === "compact" ? "lg:grid-cols-4" : "lg:grid-cols-4"} gap-4`}
    >
      {cards.map((c, i) => (
        <KpiCard key={i} {...c} />
      ))}
    </div>
  );
}
