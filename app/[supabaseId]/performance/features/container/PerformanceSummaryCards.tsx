"use client";

import { CalendarCheck2, Handshake, UserRoundX, UsersRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { usePerformanceContext } from '../context/PerformanceContext';

function KpiCard({
  title,
  value,
  helper,
  icon: Icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="text-muted-foreground" />
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-4xl font-semibold leading-none">{value}</p>
        <p className="text-sm text-muted-foreground">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function PerformanceSummaryCards() {
  const { data, isLoading } = usePerformanceContext();

  if (isLoading && !data) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-44 w-full" />
        ))}
      </div>
    );
  }

  const kpis = data?.kpis;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        title="Vendas fechadas"
        value={String(kpis?.closedSales ?? 0)}
        helper="No período selecionado"
        icon={Handshake}
      />
      <KpiCard
        title="Reuniões realizadas"
        value={String(kpis?.meetingsHeld ?? 0)}
        helper="Leads com reunião marcada como realizada"
        icon={CalendarCheck2}
      />
      <KpiCard
        title="Agendamentos realizados"
        value={String(kpis?.scheduledLeads ?? 0)}
        helper="Baseado em leads_schedule"
        icon={UsersRound}
      />
      <KpiCard
        title="Taxa de no-show"
        value={`${(kpis?.noShowRate ?? 0).toFixed(1)}%`}
        helper={`${kpis?.noShowCount ?? 0} leads em no-show`}
        icon={UserRoundX}
      />
    </div>
  );
}
