"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTeamContext } from '@/app/context/TeamContext';
import { carteiraService } from '../services/CarteiraService';
import {
  DEFAULT_CARTEIRA_FILTERS,
  DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER,
  DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY,
  CARTEIRA_TABLE_COLUMN_OPTIONS,
  type CarteiraTableColumnKey,
  type CarteiraData,
  type CarteiraDetailData,
  type CarteiraFiltersState,
  type CarteiraRow,
  type CreateCarteiraPayload,
  type UpdateCarteiraData,
  type UpdateCarteiraDetailPayload,
} from './CarteiraTypes';

export function useCarteiraHook() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();

  const [data, setData] = useState<CarteiraData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<CarteiraFiltersState>(DEFAULT_CARTEIRA_FILTERS);
  const [availableOperadoras, setAvailableOperadoras] = useState<string[]>([]);
  const [tableColumnVisibility, setTableColumnVisibility] = useState<Record<CarteiraTableColumnKey, boolean>>(() => {
    if (typeof window === 'undefined') return DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY;
    return DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY;
  });
  const [tableColumnOrder, setTableColumnOrder] = useState<CarteiraTableColumnKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER;
    return DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER;
  });

  const lastFetchKey = useRef<string>('');
  const columnVisibilityStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `carteira:table-column-visibility:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);
  const columnOrderStorageKey = useMemo(() => {
    if (!supabaseId || !activeTeamId) return null;
    return `carteira:table-column-order:${supabaseId}:${activeTeamId}`;
  }, [supabaseId, activeTeamId]);

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
      if (result.availableOperadoras.length > 0) {
        setAvailableOperadoras(result.availableOperadoras);
      }
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

  const setFilters = useCallback((next: CarteiraFiltersState) => {
    setFiltersState(next);
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_CARTEIRA_FILTERS);
  }, []);

  useEffect(() => {
    if (!columnVisibilityStorageKey || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(columnVisibilityStorageKey);
      if (!stored) {
        setTableColumnVisibility(DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY);
        return;
      }
      const parsed = JSON.parse(stored) as Partial<Record<CarteiraTableColumnKey, boolean>>;
      const normalized = { ...DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY };
      CARTEIRA_TABLE_COLUMN_OPTIONS.forEach((option) => {
        const value = parsed[option.key];
        if (typeof value === 'boolean') {
          normalized[option.key] = value;
        }
      });
      setTableColumnVisibility(normalized);
    } catch (error) {
      console.error('Erro ao carregar visibilidade das colunas da carteira:', error);
      setTableColumnVisibility(DEFAULT_CARTEIRA_TABLE_COLUMN_VISIBILITY);
    }
  }, [columnVisibilityStorageKey]);

  useEffect(() => {
    if (!columnOrderStorageKey || typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(columnOrderStorageKey);
      if (!stored) {
        setTableColumnOrder(DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER);
        return;
      }
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        setTableColumnOrder(DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER);
        return;
      }
      const validKeys = new Set(CARTEIRA_TABLE_COLUMN_OPTIONS.map((option) => option.key));
      const parsedKeys = parsed.filter((value): value is CarteiraTableColumnKey => validKeys.has(value as CarteiraTableColumnKey));
      const missingKeys = DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER.filter((key) => !parsedKeys.includes(key));
      setTableColumnOrder([...parsedKeys, ...missingKeys]);
    } catch (error) {
      console.error('Erro ao carregar ordem das colunas da carteira:', error);
      setTableColumnOrder(DEFAULT_CARTEIRA_TABLE_COLUMN_ORDER);
    }
  }, [columnOrderStorageKey]);

  useEffect(() => {
    if (!columnVisibilityStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(tableColumnVisibility));
    } catch (error) {
      console.error('Erro ao salvar visibilidade das colunas da carteira:', error);
    }
  }, [columnVisibilityStorageKey, tableColumnVisibility]);

  useEffect(() => {
    if (!columnOrderStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(columnOrderStorageKey, JSON.stringify(tableColumnOrder));
    } catch (error) {
      console.error('Erro ao salvar ordem das colunas da carteira:', error);
    }
  }, [columnOrderStorageKey, tableColumnOrder]);

  const updateEntry = useCallback(async (leadId: string, updateData: UpdateCarteiraData) => {
    if (!supabaseId || !activeTeamId) return;

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
      lastFetchKey.current = '';
      fetchData(filters);
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar carteira');
    }
  }, [supabaseId, activeTeamId, filters, fetchData]);

  const createEntry = useCallback(async (payload: CreateCarteiraPayload): Promise<CarteiraDetailData> => {
    if (!supabaseId || !activeTeamId) throw new Error('Sessão não disponível');
    const created = await carteiraService.createEntry(supabaseId, activeTeamId, payload);
    lastFetchKey.current = '';
    await fetchData(filters);
    toast.success('Cliente adicionado na carteira');
    return created;
  }, [supabaseId, activeTeamId, fetchData, filters]);

  const getEntryDetail = useCallback(async (leadId: string): Promise<CarteiraDetailData> => {
    if (!supabaseId || !activeTeamId) throw new Error('Sessão não disponível');
    return carteiraService.getEntryDetail(supabaseId, activeTeamId, leadId);
  }, [supabaseId, activeTeamId]);

  const updateEntryDetail = useCallback(async (
    leadId: string,
    payload: UpdateCarteiraDetailPayload
  ): Promise<CarteiraDetailData> => {
    if (!supabaseId || !activeTeamId) throw new Error('Sessão não disponível');
    return carteiraService.updateEntryDetail(supabaseId, activeTeamId, leadId, payload);
  }, [supabaseId, activeTeamId]);

  return {
    data,
    isLoading,
    error,
    filters,
    availableOperadoras,
    setFilter,
    setFilters,
    setPage,
    clearFilters,
    tableColumnVisibility,
    setTableColumnVisibility,
    tableColumnOrder,
    setTableColumnOrder,
    createEntry,
    updateEntry,
    getEntryDetail,
    updateEntryDetail,
  };
}
