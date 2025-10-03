'use client';

import { useState, useCallback } from 'react';
import { IDashboardState, IDashboardActions } from './DashboardTypes';
import { IDashboardMetricsService, MetricsFilters } from '../services/IDashboardMetricsService';

interface UseDashboardHookProps {
  supabaseId: string;
  dashboardService: IDashboardMetricsService;
  initialFilters?: MetricsFilters;
}

interface UseDashboardHookReturn extends IDashboardState, IDashboardActions {}

export function useDashboardHook({ 
  supabaseId, 
  dashboardService, 
  initialFilters 
}: UseDashboardHookProps): UseDashboardHookReturn {
  // Estados principais
  const [metrics, setMetrics] = useState<IDashboardState['metrics']>(null);
  const [detailedMetrics, setDetailedMetrics] = useState<IDashboardState['detailedMetrics']>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de filtros
  const [filters, setFilters] = useState<MetricsFilters>(
    initialFilters || { period: '30d' }
  );
  const [customDateRange, setCustomDateRange] = useState<IDashboardState['customDateRange']>(null);

  // Ação para buscar métricas
  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Preparar filtros finais
      const finalFilters: MetricsFilters = customDateRange 
        ? {
            ...filters,
            startDate: customDateRange.startDate,
            endDate: customDateRange.endDate,
          }
        : filters;

      // Buscar dados em paralelo
      const [metricsData, detailedData] = await Promise.all([
        dashboardService.getMetrics(supabaseId, finalFilters),
        dashboardService.getDetailedMetrics(supabaseId),
      ]);

      setMetrics(metricsData);
      setDetailedMetrics(detailedData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar métricas';
      setError(errorMessage);
      console.error('Erro ao buscar métricas do dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId, dashboardService, filters, customDateRange]);

  // Ação para atualizar filtros
  const updateFilters = useCallback((newFilters: Partial<MetricsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    
    // Se estiver atualizando período, limpar data range customizada
    if (newFilters.period) {
      setCustomDateRange(null);
    }
  }, []);

  // Ação para definir período específico
  const setPeriod = useCallback((period: '7d' | '30d' | '3m' | '6m' | '1y') => {
    setFilters(prev => ({ ...prev, period }));
    setCustomDateRange(null);
  }, []);

  // Ação para definir data range customizada
  const setCustomDateRangeAction = useCallback((startDate: string, endDate: string) => {
    setCustomDateRange({ startDate, endDate });
    // Limpar período dos filtros ao usar data customizada
    setFilters(prev => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { period, ...rest } = prev;
      return rest;
    });
  }, []);

  // Ação para limpar data range customizada
  const clearCustomDateRange = useCallback(() => {
    setCustomDateRange(null);
    // Voltar para período padrão
    setFilters(prev => ({ ...prev, period: '30d' }));
  }, []);

  // Ação para limpar erros
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Ação para resetar filtros
  const resetFilters = useCallback(() => {
    setFilters({ period: '30d' });
    setCustomDateRange(null);
  }, []);

  // Ação para refresh (alias para fetchMetrics)
  const refreshMetrics = useCallback(async () => {
    await fetchMetrics();
  }, [fetchMetrics]);

  return {
    // Estado
    metrics,
    detailedMetrics,
    isLoading,
    error,
    filters,
    customDateRange,
    
    // Ações
    fetchMetrics,
    refreshMetrics,
    updateFilters,
    setPeriod,
    setCustomDateRange: setCustomDateRangeAction,
    clearCustomDateRange,
    clearError,
    resetFilters,
  };
}