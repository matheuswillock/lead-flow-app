"use client";

import { AlertCircle, Download, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { usePerformanceContext } from '../context/PerformanceContext';
import { PerformanceFiltersBar } from './PerformanceFiltersBar';
import { PerformanceSummaryCards } from './PerformanceSummaryCards';
import { PerformanceTopHighlights } from './PerformanceTopHighlights';
import { PerformanceRankings } from './PerformanceRankings';
import { PerformanceTable } from './PerformanceTable';

export function PerformanceContainer() {
  const { data, error } = usePerformanceContext();

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Header Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl md:text-5xl font-bold font-[Poppins] leading-tight">
              Performance
            </h1>
            <p className="text-base text-muted-foreground">
              Indicadores comerciais e ranking de SDRs e Closers — últimos 7 dias
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Badge variant="outline" className="w-fit">
              Última atualização: há 2 min
            </Badge>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4" />
                Exportar relatório
              </Button>
              <Button size="sm">
                <Plus className="w-4 h-4" />
                Nova meta
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <PerformanceFiltersBar />

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* KPI Summary Cards */}
      <PerformanceSummaryCards />

      {/* Top Highlights */}
      <PerformanceTopHighlights />

      {/* Rankings */}
      <PerformanceRankings />

      {/* Table */}
      <PerformanceTable />
    </div>
  );
}
