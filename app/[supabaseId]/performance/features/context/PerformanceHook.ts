"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTeamContext } from '@/app/context/TeamContext';
import { performanceService } from '../services/PerformanceService';
import {
  DEFAULT_PERFORMANCE_FILTERS,
  type PerformanceData,
  type PerformanceFiltersState,
  type PerformancePreset,
} from './PerformanceTypes';

export function usePerformanceHook() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();

  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<PerformanceFiltersState>(DEFAULT_PERFORMANCE_FILTERS);

  const lastFetchKey = useRef<string>('');

  const fetchData = useCallback(async (currentFilters: PerformanceFiltersState) => {
    if (!supabaseId || !activeTeamId) return;

    const key = `${supabaseId}|${activeTeamId}|${JSON.stringify(currentFilters)}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;

    setIsLoading(true);
    setError(null);

    try {
      const result = await performanceService.getSalesPerformance(supabaseId, activeTeamId, currentFilters);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar performance';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  const setFilter = useCallback(<K extends keyof PerformanceFiltersState>(
    key: K,
    value: PerformanceFiltersState[K]
  ) => {
    setFiltersState((prev) => ({
      ...prev,
      [key]: value,
      ...(key !== 'page' ? { page: 1 } : {}),
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState((prev) => ({ ...prev, page }));
  }, []);

  const setPreset = useCallback((preset: PerformancePreset) => {
    setFiltersState((prev) => ({
      ...prev,
      preset,
      startDate: '',
      endDate: '',
      page: 1,
    }));
  }, []);

  const setDateRange = useCallback((startDate: string, endDate: string) => {
    setFiltersState((prev) => ({
      ...prev,
      startDate,
      endDate,
      page: 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_PERFORMANCE_FILTERS);
  }, []);

  return {
    data,
    isLoading,
    error,
    filters,
    setFilter,
    setPage,
    setPreset,
    setDateRange,
    clearFilters,
    refetch: () => {
      lastFetchKey.current = '';
      fetchData(filters);
    },
  };
}
