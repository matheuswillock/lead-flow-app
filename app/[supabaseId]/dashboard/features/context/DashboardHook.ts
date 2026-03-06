'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { IDashboardState, IDashboardActions } from './DashboardTypes';
import { IDashboardMetricsService, MetricsFilters } from '../services/IDashboardMetricsService';

interface UseDashboardHookProps {
  supabaseId: string;
  teamId: string;
  dashboardService: IDashboardMetricsService;
  initialFilters?: MetricsFilters;
}

interface UseDashboardHookReturn extends IDashboardState, IDashboardActions {}
interface FetchMetricsOptions {
  forceDetailed?: boolean;
}

export function useDashboardHook({ 
  supabaseId, 
  teamId,
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
  const detailedMetricsRef = useRef<IDashboardState['detailedMetrics']>(null);
  const detailedContextKeyRef = useRef<string | null>(null);
  
  // Estado de privacidade
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const skipPersistBlurRef = useRef(false);

  const blurStorageKey = useMemo(() => {
    if (!supabaseId) return null;
    return `dashboardBlur:${supabaseId}:${teamId || 'default'}`;
  }, [supabaseId, teamId]);

  useEffect(() => {
    skipPersistBlurRef.current = true;
    if (!blurStorageKey || typeof window === 'undefined') {
      setIsBlurred(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(blurStorageKey);
      if (!raw) {
        setIsBlurred(false);
        return;
      }
      setIsBlurred(raw === 'true');
    } catch (error) {
      console.warn('Nao foi possivel carregar a preferencia de blur:', error);
      setIsBlurred(false);
    }
  }, [blurStorageKey]);

  useEffect(() => {
    if (!blurStorageKey || typeof window === 'undefined') {
      return;
    }
    if (skipPersistBlurRef.current) {
      skipPersistBlurRef.current = false;
      return;
    }
    try {
      window.localStorage.setItem(blurStorageKey, String(isBlurred));
    } catch (error) {
      console.warn('Nao foi possivel salvar a preferencia de blur:', error);
    }
  }, [blurStorageKey, isBlurred]);

  useEffect(() => {
    detailedMetricsRef.current = detailedMetrics;
  }, [detailedMetrics]);

  useEffect(() => {
    const currentKey = supabaseId && teamId ? `${supabaseId}:${teamId}` : null;
    if (detailedContextKeyRef.current && detailedContextKeyRef.current !== currentKey) {
      detailedContextKeyRef.current = null;
      detailedMetricsRef.current = null;
      setDetailedMetrics(null);
    }
  }, [supabaseId, teamId]);

  // Ação para buscar métricas
  const fetchMetrics = useCallback(async (options?: FetchMetricsOptions) => {
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

      const detailedKey = `${supabaseId}:${teamId}`;
      const shouldFetchDetailed =
        options?.forceDetailed === true ||
        detailedContextKeyRef.current !== detailedKey ||
        !detailedMetricsRef.current;

      const detailedFallback = detailedMetricsRef.current ?? [];

      // Buscar dados em paralelo
      const [metricsData, detailedData] = await Promise.all([
        dashboardService.getMetrics(supabaseId, teamId, finalFilters),
        shouldFetchDetailed
          ? dashboardService.getDetailedMetrics(supabaseId, teamId)
          : Promise.resolve(detailedFallback),
      ]);

      setMetrics(metricsData);
      if (shouldFetchDetailed) {
        setDetailedMetrics(detailedData);
        detailedMetricsRef.current = detailedData;
        detailedContextKeyRef.current = detailedKey;
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido ao carregar métricas';
      setError(errorMessage);
      console.error('Erro ao buscar métricas do dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId, teamId, dashboardService, filters, customDateRange]);

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
    // Limpar cache antes de fazer refresh
    if ('clearCache' in dashboardService && typeof dashboardService.clearCache === 'function') {
      const finalFilters = customDateRange 
        ? {
            ...filters,
            startDate: customDateRange.startDate,
            endDate: customDateRange.endDate,
          }
        : filters;
      
      dashboardService.clearCache(supabaseId, teamId, finalFilters);
    }
    
    if ('clearDetailedCache' in dashboardService && typeof dashboardService.clearDetailedCache === 'function') {
      dashboardService.clearDetailedCache(supabaseId, teamId);
      detailedContextKeyRef.current = null;
      detailedMetricsRef.current = null;
    }

    await fetchMetrics({ forceDetailed: true });
  }, [fetchMetrics, dashboardService, supabaseId, teamId, filters, customDateRange]);
  
  // Ação para toggle de blur
  const toggleBlur = useCallback(() => {
    setIsBlurred(prev => !prev);
  }, []);

  return {
    // Estado
    metrics,
    detailedMetrics,
    isLoading,
    error,
    filters,
    customDateRange,
    isBlurred,
    
    // Ações
    fetchMetrics,
    refreshMetrics,
    updateFilters,
    setPeriod,
    setCustomDateRange: setCustomDateRangeAction,
    clearCustomDateRange,
    clearError,
    resetFilters,
    toggleBlur,
  };
}
