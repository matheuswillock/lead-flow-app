"use client";

import { useMemo } from 'react';
import { CalendarCheck2, Handshake, TrendingUp, UserRoundX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { usePerformanceContext } from '../context/PerformanceContext';

interface KpiCardProps {
  title: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accentColor: string;
  delta?: number;
  sparklineData?: Array<{ value: number }>;
}

function KpiCard({
  title,
  value,
  helper,
  icon: Icon,
  accentColor,
  delta,
  sparklineData,
}: KpiCardProps) {
  // Use real sparkline data from backend
  const data = useMemo(() => {
    return sparklineData || [];
  }, [sparklineData]);

  const deltaColor = delta === undefined ? 'text-muted-foreground' : delta >= 0 ? 'text-[var(--semantic-success)]' : 'text-[var(--semantic-danger)]';

  return (
    <Card 
      className="overflow-hidden border-l-4" 
      style={{ 
        borderLeftColor: accentColor,
        boxShadow: `inset 0 0 20px ${accentColor}15, -4px 0 12px ${accentColor}30`
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)` }}
        >
          <Icon className="w-4 h-4" style={{ color: accentColor }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-baseline gap-2">
          <p className="text-4xl font-bold leading-none">{value}</p>
          {delta !== undefined && (
            <p className={`text-xs font-semibold ${deltaColor}`}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
            </p>
          )}
        </div>

        {/* Sparkline */}
        <div className="h-8 w-full mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={accentColor}
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                isAnimationActive={false}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground mt-1">{helper}</p>
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
          <Skeleton key={idx} className="h-48 w-full" />
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
        accentColor="var(--primary)"
        delta={8.2}
        sparklineData={kpis?.closedSalesSparkline}
      />
      <KpiCard
        title="Reuniões realizadas"
        value={String(kpis?.meetingsHeld ?? 0)}
        helper="Leads com reunião marcada como realizada"
        icon={CalendarCheck2}
        accentColor="var(--semantic-info)"
        delta={-1.5}
        sparklineData={kpis?.meetingsHeldSparkline}
      />
      <KpiCard
        title="Agendamentos realizados"
        value={String(kpis?.scheduledLeads ?? 0)}
        helper="Baseado em leads_schedule"
        icon={TrendingUp}
        accentColor="var(--semantic-success)"
        delta={5.6}
        sparklineData={kpis?.scheduledLeadsSparkline}
      />
      <KpiCard
        title="Taxa de no-show"
        value={`${(kpis?.noShowRate ?? 0).toFixed(1)}%`}
        helper={`${kpis?.noShowCount ?? 0} leads em no-show`}
        icon={UserRoundX}
        accentColor="var(--semantic-warning)"
        delta={-3.1}
        sparklineData={kpis?.noShowRateSparkline}
      />
    </div>
  );
}
