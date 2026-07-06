"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IMultiskillTransfersService } from "../services/IMultiskillTransfersService";
import type {
  IMultiskillTransfersActions,
  IMultiskillTransfersState,
  MultiskillTransfersData,
  MultiskillTransfersFiltersState,
} from "./MultiskillTransfersTypes";
import { DEFAULT_MULTISKILL_TRANSFERS_FILTERS } from "./MultiskillTransfersTypes";

interface UseMultiskillTransfersHookProps {
  supabaseId: string;
  service: IMultiskillTransfersService;
}

function buildListKey(filters: MultiskillTransfersFiltersState) {
  return JSON.stringify(filters);
}

export function useMultiskillTransfersHook({
  supabaseId,
  service,
}: UseMultiskillTransfersHookProps): IMultiskillTransfersState & IMultiskillTransfersActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MultiskillTransfersData | null>(null);
  const [filters, setFiltersState] = useState<MultiskillTransfersFiltersState>(
    DEFAULT_MULTISKILL_TRANSFERS_FILTERS
  );

  const listInFlight = useRef(false);
  const lastListSuccessKey = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const requestKey = buildListKey(filters);
    if (listInFlight.current || lastListSuccessKey.current === requestKey) return;

    listInFlight.current = true;
    try {
      setIsLoading(true);
      setError(null);
      const result = await service.listTargets(supabaseId, filters);
      setData(result);
      lastListSuccessKey.current = requestKey;
    } catch (loadError) {
      console.error("[useMultiskillTransfersHook]", loadError);
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar destinos");
      lastListSuccessKey.current = null;
    } finally {
      setIsLoading(false);
      listInFlight.current = false;
    }
  }, [service, supabaseId, filters]);

  const setFilters = useCallback((patch: Partial<MultiskillTransfersFiltersState>) => {
    setFiltersState((previous) => {
      const next = { ...previous, ...patch };
      if (patch.q !== undefined && patch.page === undefined) {
        next.page = 1;
      }
      return next;
    });
    lastListSuccessKey.current = null;
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void load();
    }, filters.q ? 300 : 0);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [load, filters]);

  return {
    isLoading,
    error,
    data,
    filters,
    load,
    setFilters,
  };
}
