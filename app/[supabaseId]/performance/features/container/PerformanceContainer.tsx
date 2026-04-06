"use client";

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePerformanceContext } from '../context/PerformanceContext';
import { PerformanceFiltersBar } from './PerformanceFiltersBar';
import { PerformanceSummaryCards } from './PerformanceSummaryCards';
import { PerformanceRankings } from './PerformanceRankings';
import { PerformanceTable } from './PerformanceTable';

export function PerformanceContainer() {
  const { error } = usePerformanceContext();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Performance</h1>
        <p className="text-sm text-muted-foreground">Vendas com reunião realizada no período selecionado</p>
      </div>

      <PerformanceFiltersBar />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PerformanceSummaryCards />

      <PerformanceRankings />

      <PerformanceTable />
    </div>
  );
}
