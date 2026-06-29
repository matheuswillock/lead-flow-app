'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { IDashboardState, IDashboardActions, DashboardTeamScope } from './DashboardTypes';
import { IDashboardMetricsService, MetricsFilters } from '../services/IDashboardMetricsService';

interface UseDashboardHookProps {
  supabaseId: string;
  teamId: string;
  teamScope: DashboardTeamScope;
  canUseAllTeamsScope: boolean;
  dashboardService: IDashboardMetricsService;
  initialFilters?: MetricsFilters;
  onTeamScopeChange?: (scope: DashboardTeamScope) => void;
}

interface UseDashboardHookReturn extends IDashboardState, IDashboardActions {}

interface FetchMetricsOptions {
  forceDetailed?: boolean;
}

export function useDashboardHook({ 
  supabaseId, 
  teamId,
  teamScope,
  canUseAllTeamsScope,
  dashboardService, 
  initialFilters,
  onTeamScopeChange,
}: UseDashboardHookProps): UseDashboardHookReturn {
  const [metrics, setMetrics] = useState<IDashboardState['metrics']>(null);
  const [detailedMetrics, setDetailedMetrics] = useState<IDashboardState['detailedMetrics']>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState<MetricsFilters>(
    initialFilters || { period: '30d' }
  );
  const [customDateRange, setCustomDateRange] = useState<IDashboardState['customDateRange']>(null);
  const detailedMetricsRef = useRef<IDashboardState['detailedMetrics']>(null);
  const detailedContextKeyRef = useRef<string | null>(null);
  
  const [isBlurred, setIsBlurred] = useState<boolean>(false);
  const skipPersistBlurRef = useRef(false);

  const effectiveTeamScope: DashboardTeamScope =
    canUseAllTeamsScope ? teamScope : 'active';

  const blurStorageKey = useMemo(() => {
    if (!supabaseId) return null;
    return `dashboardBlur:${supabaseId}:${teamId || 'default'}:${effectiveTeamScope}`;
  }, [supabaseId, teamId, effectiveTeamScope]);

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
    const currentKey = supabaseId && teamId
      ? `${supabaseId}:${teamId}:${effectiveTeamScope}`
      : null;
    if (detailedContextKeyRef.current && detailedContextKeyRef.current !== currentKey) {
      detailedContextKeyRef.current = null;
      detailedMetricsRef.current = null;
      setDetailedMetrics(null);
    }
  }, [supabaseId, teamId, effectiveTeamScope]);

  const fetchMetrics = useCallback(async (options?: FetchMetricsOptions) => {
    try {
      setIsLoading(true);
      setError(null);

      const finalFilters: MetricsFilters = customDateRange 
        ? {
            ...filters,
            startDate: customDateRange.startDate,
            endDate: customDateRange.endDate,
            teamScope: effectiveTeamScope,
          }
        : { ...filters, teamScope: effectiveTeamScope };

      const detailedKey = `${supabaseId}:${teamId}:${effectiveTeamScope}`;
      const shouldFetchDetailed =
        options?.forceDetailed === true ||
        detailedContextKeyRef.current !== detailedKey ||
        !detailedMetricsRef.current;

      const detailedFallback = detailedMetricsRef.current ?? [];

      const [metricsData, detailedData] = await Promise.all([
        dashboardService.getMetrics(supabaseId, teamId, finalFilters),
        shouldFetchDetailed
          ? dashboardService.getDetailedMetrics(supabaseId, teamId, effectiveTeamScope)
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
  }, [supabaseId, teamId, effectiveTeamScope, dashboardService, filters, customDateRange]);

  const updateFilters = useCallback((newFilters: Partial<MetricsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    
    if (newFilters.period) {
      setCustomDateRange(null);
    }
  }, []);

  const setPeriod = useCallback((period: '7d' | '30d' | '3m' | '6m' | '1y') => {
    setFilters(prev => ({ ...prev, period }));
    setCustomDateRange(null);
  }, []);

  const setCustomDateRangeAction = useCallback((startDate: string, endDate: string) => {
    setCustomDateRange({ startDate, endDate });
    setFilters(prev => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { period, ...rest } = prev;
      return rest;
    });
  }, []);

  const clearCustomDateRange = useCallback(() => {
    setCustomDateRange(null);
    setFilters(prev => ({ ...prev, period: '30d' }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ period: '30d' });
    setCustomDateRange(null);
  }, []);

  const refreshMetrics = useCallback(async () => {
    if ('clearCache' in dashboardService && typeof dashboardService.clearCache === 'function') {
      const finalFilters = customDateRange 
        ? {
            ...filters,
            startDate: customDateRange.startDate,
            endDate: customDateRange.endDate,
            teamScope: effectiveTeamScope,
          }
        : { ...filters, teamScope: effectiveTeamScope };
      
      dashboardService.clearCache(supabaseId, teamId, finalFilters);
    }
    
    if ('clearDetailedCache' in dashboardService && typeof dashboardService.clearDetailedCache === 'function') {
      dashboardService.clearDetailedCache(supabaseId, teamId, effectiveTeamScope);
      detailedContextKeyRef.current = null;
      detailedMetricsRef.current = null;
    }

    await fetchMetrics({ forceDetailed: true });
  }, [fetchMetrics, dashboardService, supabaseId, teamId, effectiveTeamScope, filters, customDateRange]);
  
  const toggleBlur = useCallback(() => {
    setIsBlurred(prev => !prev);
  }, []);

  const setTeamScope = useCallback((scope: DashboardTeamScope) => {
    if (!canUseAllTeamsScope && scope === 'all') {
      return;
    }
    onTeamScopeChange?.(scope);
  }, [canUseAllTeamsScope, onTeamScopeChange]);

  return {
    metrics,
    detailedMetrics,
    isLoading,
    error,
    filters,
    teamScope: effectiveTeamScope,
    canUseAllTeamsScope,
    customDateRange,
    isBlurred,
    fetchMetrics,
    refreshMetrics,
    updateFilters,
    setPeriod,
    setCustomDateRange: setCustomDateRangeAction,
    clearCustomDateRange,
    setTeamScope,
    clearError,
    resetFilters,
    toggleBlur,
  };
}
