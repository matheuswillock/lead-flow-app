"use client";

import { 
  DollarSign, 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  UserX,
  HandshakeIcon
} from "lucide-react";
import { MetricCard } from "./MetricCard";
import { DashboardMetrics } from "../types";

interface MetricsGridProps {
  metrics: DashboardMetrics;
  className?: string;
}

export function MetricsGrid({ metrics, className }: MetricsGridProps) {
  return (
    <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* Receita Total */}
      <MetricCard
        title="Receita Total"
        metric={{
          ...metrics.totalRevenue,
          format: "currency",
          label: "Receita de vendas fechadas"
        }}
        icon={DollarSign}
      />

      {/* Vendas Fechadas */}
      <MetricCard
        title="Vendas Fechadas"
        metric={{
          ...metrics.vendasFechadas,
          format: "number",
          label: "Leads convertidos em vendas"
        }}
        icon={HandshakeIcon}
      />

      {/* Novos Leads */}
      <MetricCard
        title="Novos Leads"
        metric={{
          ...metrics.newLeads,
          format: "number",
          label: "Leads captados no período"
        }}
        icon={Users}
      />

      {/* Taxa de Conversão */}
      <MetricCard
        title="Taxa de Conversão"
        metric={{
          ...metrics.conversionRate,
          format: "percentage",
          label: "Leads convertidos em vendas"
        }}
        icon={Target}
      />

      {/* Cotações */}
      <MetricCard
        title="Cotações"
        metric={{
          ...metrics.cotacoes,
          format: "number",
          label: "Cotações realizadas"
        }}
        icon={TrendingUp}
      />

      {/* Mensalidade Atual */}
      <MetricCard
        title="Mensalidade Média"
        metric={{
          ...metrics.mensalidadeAtual,
          format: "currency",
          label: "Valor médio das mensalidades"
        }}
        icon={DollarSign}
      />

      {/* Agendamentos */}
      <MetricCard
        title="Agendamentos"
        metric={{
          ...metrics.agendamentos,
          format: "number",
          label: "Reuniões agendadas"
        }}
        icon={Calendar}
      />

      {/* Taxa de No-show */}
      <MetricCard
        title="Taxa de No-show"
        metric={{
          ...metrics.noShowRate,
          format: "percentage",
          label: "Faltas em agendamentos"
        }}
        icon={UserX}
      />
    </div>
  );
}