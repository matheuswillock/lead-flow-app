"use client";

import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useDashboard } from "../context/DashboardHook";
import { DashboardContainerProps, TimePeriod } from "../types";
import { MetricsGrid } from "./MetricsGrid";
import { PieChartComponent } from "./PieChartComponent";
import { BarChartComponent } from "./BarChartComponent";

export function DashboardContainer({ supabaseId }: DashboardContainerProps) {
  const {
    metrics,
    isLoading,
    error,
    selectedPeriod,
    lastUpdated,
    changePeriod,
    refresh,
    clearError,
  } = useDashboard(supabaseId);

  const periodOptions: { value: TimePeriod; label: string }[] = [
    { value: "7d", label: "Últimos 7 dias" },
    { value: "30d", label: "Últimos 30 dias" },
    { value: "90d", label: "Últimos 90 dias" },
    { value: "12m", label: "Últimos 12 meses" },
  ];

  const handlePeriodChange = (period: TimePeriod) => {
    changePeriod(period);
  };

  const formatLastUpdated = (date: Date) => {
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Estado de loading
  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Estado de erro
  if (error && !metrics) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
        <div className="flex justify-center">
          <Button onClick={() => { clearError(); refresh(); }} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com controles */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          {lastUpdated && (
            <p className="text-sm text-muted-foreground">
              Última atualização: {formatLastUpdated(lastUpdated)}
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={selectedPeriod} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button
            onClick={refresh}
            variant="outline"
            size="icon"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Erro não bloqueante */}
      {error && metrics && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Grid de métricas */}
      {metrics && (
        <>
          <MetricsGrid metrics={metrics} />
          
          {/* Gráficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pizza Chart - Distribuição Kanban */}
            <PieChartComponent
              data={metrics.kanbanDistribution}
              title="Distribuição de Leads (Kanban)"
            />
            
            {/* Bar Chart - Agendamentos por dia */}
            <BarChartComponent
              data={metrics.agendamentosPorDia}
              title="Agendamentos por Dia"
            />
          </div>
        </>
      )}
    </div>
  );
}