"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTeamContext } from '@/app/context/TeamContext';
import { useTimezone } from '@/app/context/TimezoneContext';
import { meetingsHeldService } from '../services/MeetingsHeldService';
import {
  buildDefaultMeetingsHeldFilters,
  type MeetingsHeldData,
  type MeetingsHeldFiltersState,
} from './MeetingsHeldTypes';

export function useMeetingsHeldHook() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();
  const { tz } = useTimezone();

  const [data, setData] = useState<MeetingsHeldData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<MeetingsHeldFiltersState>(() =>
    buildDefaultMeetingsHeldFilters(tz)
  );

  const lastFetchKey = useRef<string>('');

  const fetchData = useCallback(
    async (currentFilters: MeetingsHeldFiltersState) => {
      if (!supabaseId || !activeTeamId) return;
      if (!currentFilters.startDate || !currentFilters.endDate) return;

      const key = `${supabaseId}|${activeTeamId}|${JSON.stringify(currentFilters)}`;
      if (lastFetchKey.current === key) return;
      lastFetchKey.current = key;

      setIsLoading(true);
      setError(null);

      try {
        const result = await meetingsHeldService.getMeetingsHeld(
          supabaseId,
          activeTeamId,
          currentFilters
        );
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao buscar reuniões realizadas';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [supabaseId, activeTeamId]
  );

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  const setFilter = useCallback(
    <K extends keyof MeetingsHeldFiltersState>(key: K, value: MeetingsHeldFiltersState[K]) => {
      setFiltersState((prev) => ({
        ...prev,
        [key]: value,
        ...(key !== 'page' && key !== 'countMonth' ? { page: 1 } : {}),
      }));
    },
    []
  );

  const setDateRange = useCallback((startDate: string, endDate: string) => {
    setFiltersState((prev) => ({
      ...prev,
      startDate,
      endDate,
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState((prev) => ({ ...prev, page }));
  }, []);

  const refetch = useCallback(() => {
    lastFetchKey.current = '';
    fetchData(filters);
  }, [fetchData, filters]);

  return {
    data,
    isLoading,
    error,
    filters,
    setFilter,
    setDateRange,
    setPage,
    refetch,
  };
}
