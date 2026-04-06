"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTeamContext } from '@/app/context/TeamContext';
import { carteiraService } from '../services/CarteiraService';
import {
  DEFAULT_CARTEIRA_FILTERS,
  type CarteiraData,
  type CarteiraFiltersState,
  type CarteiraRow,
  type UpdateCarteiraData,
} from './CarteiraTypes';

export function useCarteiraHook() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();

  const [data, setData] = useState<CarteiraData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<CarteiraFiltersState>(DEFAULT_CARTEIRA_FILTERS);

  const lastFetchKey = useRef<string>('');

  const fetchData = useCallback(async (currentFilters: CarteiraFiltersState) => {
    if (!supabaseId || !activeTeamId) return;

    const key = `${supabaseId}|${activeTeamId}|${JSON.stringify(currentFilters)}`;
    if (lastFetchKey.current === key) return;
    lastFetchKey.current = key;

    setIsLoading(true);
    setError(null);

    try {
      const result = await carteiraService.listPortfolio(supabaseId, activeTeamId, currentFilters);
      setData(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar carteira';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [supabaseId, activeTeamId]);

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  const setFilter = useCallback(<K extends keyof CarteiraFiltersState>(
    key: K,
    value: CarteiraFiltersState[K]
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

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_CARTEIRA_FILTERS);
  }, []);

  const updateEntry = useCallback(async (leadId: string, updateData: UpdateCarteiraData) => {
    if (!supabaseId || !activeTeamId) return;

    // Optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((row: CarteiraRow) =>
          row.leadId === leadId ? { ...row, ...updateData } : row
        ),
      };
    });

    try {
      const updated = await carteiraService.updateEntry(supabaseId, activeTeamId, leadId, updateData);
      // Replace with server response
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((row: CarteiraRow) =>
            row.leadId === leadId ? updated : row
          ),
        };
      });
      toast.success('Carteira atualizada');
    } catch (err) {
      // Revert optimistic update
      lastFetchKey.current = '';
      fetchData(filters);
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar carteira');
    }
  }, [supabaseId, activeTeamId, filters, fetchData]);

  return {
    data,
    isLoading,
    error,
    filters,
    setFilter,
    setPage,
    clearFilters,
    updateEntry,
  };
}
