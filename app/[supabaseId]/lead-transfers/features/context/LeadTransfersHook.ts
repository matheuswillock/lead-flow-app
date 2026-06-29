"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useTeamContext } from "@/app/context/TeamContext";
import { leadTransfersService } from "../services/LeadTransfersService";
import {
  DEFAULT_LEAD_TRANSFERS_FILTERS,
  type LeadTransfersData,
  type LeadTransfersFiltersState,
} from "./LeadTransfersTypes";

type DateRangeField =
  | "transferDate"
  | "preScheduledDate"
  | "scheduledDate";

export function useLeadTransfersHook() {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const { activeTeamId } = useTeamContext();

  const [data, setData] = useState<LeadTransfersData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<LeadTransfersFiltersState>(
    DEFAULT_LEAD_TRANSFERS_FILTERS
  );

  const inFlightKeyRef = useRef<string | null>(null);
  const lastSuccessKeyRef = useRef<string | null>(null);

  const fetchData = useCallback(
    async (currentFilters: LeadTransfersFiltersState, force = false) => {
      if (!supabaseId || !activeTeamId) return;

      const key = `${supabaseId}|${activeTeamId}|${JSON.stringify(currentFilters)}`;
      if (!force && inFlightKeyRef.current === key) return;
      if (!force && lastSuccessKeyRef.current === key) return;

      inFlightKeyRef.current = key;
      setIsLoading(true);
      setError(null);

      try {
        const result = await leadTransfersService.list(supabaseId, activeTeamId, currentFilters);
        setData(result);
        lastSuccessKeyRef.current = key;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao buscar transferências";
        setError(message);
      } finally {
        if (inFlightKeyRef.current === key) {
          inFlightKeyRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [supabaseId, activeTeamId]
  );

  useEffect(() => {
    fetchData(filters);
  }, [fetchData, filters]);

  const setFilter = useCallback(
    <K extends keyof LeadTransfersFiltersState>(key: K, value: LeadTransfersFiltersState[K]) => {
      lastSuccessKeyRef.current = null;
      setFiltersState((prev) => ({
        ...prev,
        [key]: value,
        ...(key !== "page" && key !== "pageSize" ? { page: 1 } : {}),
      }));
    },
    []
  );

  const setDateRange = useCallback((field: DateRangeField, dateFrom: string, dateTo: string) => {
    lastSuccessKeyRef.current = null;
    setFiltersState((prev) => ({
      ...prev,
      [`${field}From`]: dateFrom,
      [`${field}To`]: dateTo,
      page: 1,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    lastSuccessKeyRef.current = null;
    setFiltersState((prev) => ({ ...prev, page }));
  }, []);

  const clearFilters = useCallback(() => {
    lastSuccessKeyRef.current = null;
    setFiltersState(DEFAULT_LEAD_TRANSFERS_FILTERS);
  }, []);

  const refresh = useCallback(async () => {
    lastSuccessKeyRef.current = null;
    await fetchData(filters, true);
  }, [fetchData, filters]);

  return {
    data,
    isLoading,
    error,
    filters,
    setFilter,
    setDateRange,
    setPage,
    clearFilters,
    refresh,
  };
}
