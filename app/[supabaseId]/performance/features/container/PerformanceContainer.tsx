"use client";

import { AlertCircle, Download, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePerformanceContext } from '../context/PerformanceContext';
import { PerformanceFiltersBar } from './PerformanceFiltersBar';
import { PerformanceSummaryCards } from './PerformanceSummaryCards';
import { PerformanceRankings } from './PerformanceRankings';
import { PerformanceTable } from './PerformanceTable';

function TopHighlightCard({
  title,
  name,
  role,
  value,
  suffix,
  attendanceRate,
}: {
  title: string;
  name: string;
  role: string;
  value: number;
  suffix: string;
  attendanceRate: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold leading-none">{name}</p>
          <p className="text-sm text-muted-foreground">{role}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="text-4xl font-semibold leading-none">
            {value}
            <span className="ml-1 text-sm text-muted-foreground">{suffix}</span>
          </p>
          <p className="text-sm text-muted-foreground">{attendanceRate.toFixed(1)}% presença</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function PerformanceContainer() {
  const { data, error } = usePerformanceContext();
  const topCloser = data?.highlights.topCloser;
  const topSdr = data?.highlights.topSdr;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-4xl font-semibold leading-none">Performance</h1>
          <p className="text-sm text-muted-foreground">
            Indicadores comerciais e ranking de SDRs e Closers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Última atualização: há 2 min</Badge>
          <Button variant="outline">
            <Download data-icon="inline-start" />
            Exportar relatório
          </Button>
          <Button>
            <Plus data-icon="inline-start" />
            Nova meta
          </Button>
        </div>
      </div>

      <PerformanceFiltersBar />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PerformanceSummaryCards />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {topCloser ? (
          <TopHighlightCard
            title="Top Closer do mês"
            name={topCloser.name}
            role={topCloser.roleLabel}
            value={topCloser.value}
            suffix={topCloser.suffix}
            attendanceRate={topCloser.attendanceRate}
          />
        ) : null}

        {topSdr ? (
          <TopHighlightCard
            title="Top SDR do mês"
            name={topSdr.name}
            role={topSdr.roleLabel}
            value={topSdr.value}
            suffix={topSdr.suffix}
            attendanceRate={topSdr.attendanceRate}
          />
        ) : null}
      </div>

      <PerformanceRankings />
      <PerformanceTable />
    </div>
  );
}
