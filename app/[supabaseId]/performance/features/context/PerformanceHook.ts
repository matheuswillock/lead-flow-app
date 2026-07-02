"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTeamContext } from '@/app/context/TeamContext';
import { isManagerLikeRole } from '@/lib/roles';
import { performanceService } from '../services/PerformanceService';
import {
  DEFAULT_PERFORMANCE_FILTERS,
  type PerformanceData,
  type PerformanceFiltersState,
  type PerformancePreset,
  type PerformanceTeamScope,
} from './PerformanceTypes';

export function usePerformanceHook() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId, activeTeam, teams, isTeamMaster } = useTeamContext();

  const [data, setData] = useState<PerformanceData | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<PerformanceFiltersState>(DEFAULT_PERFORMANCE_FILTERS);
  const [teamScope, setTeamScope] = useState<PerformanceTeamScope>('active');

  const accountTeams = useMemo(() => {
    if (!activeTeam?.masterId) return [];
    return teams.filter((team) => team.masterId === activeTeam.masterId && !team.isPending);
  }, [teams, activeTeam?.masterId]);

  const canUseAllTeamsScope = useMemo(() => {
    const isDelegated = isManagerLikeRole(activeTeam?.role) && !!activeTeam?.canViewAllTeams;
    return (isTeamMaster || isDelegated) && accountTeams.length > 1;
  }, [isTeamMaster, activeTeam?.role, activeTeam?.canViewAllTeams, accountTeams.length]);

  useEffect(() => {
    if (!canUseAllTeamsScope && teamScope === 'all') {
      setTeamScope('active');
    }
  }, [canUseAllTeamsScope, teamScope]);

  const lastFetchKey = useRef<string>('');

  const fetchData = useCallback(async (currentFilters: PerformanceFiltersState, currentScope: PerformanceTeamScope) => {
    if (!supabaseId || !activeTeamId) return;

    const key = `${supabaseId}|${activeTeamId}|${currentScope}|${JSON.stringify(currentFilters)}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;

    setIsLoading(true);
    setError(null);

    try {
      const result = await performanceService.getSalesPerformance(supabaseId, activeTeamId, currentFilters, currentScope);
      setData(result);
      setLastFetchedAt(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar performance';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    fetchData(filters, teamScope);
  }, [fetchData, filters, teamScope]);

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
    lastFetchedAt,
    isLoading,
    error,
    filters,
    teamScope,
    setTeamScope,
    canUseAllTeamsScope,
    setFilter,
    setPage,
    setPreset,
    setDateRange,
    clearFilters,
    refetch: () => {
      lastFetchKey.current = '';
      fetchData(filters, teamScope);
    },
  };
}
