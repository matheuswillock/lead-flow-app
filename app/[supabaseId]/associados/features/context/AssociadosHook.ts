'use client';

import { useCallback, useEffect, useState } from "react";
import type { IAssociadosService } from "../services/IAssociadosService";
import type {
  AssociadosData,
  AssociadosFiltersState,
  IAssociadosActions,
  IAssociadosState,
} from "./AssociadosTypes";

interface UseAssociadosHookProps {
  supabaseId: string;
  teamId: string | null;
  service: IAssociadosService;
}

export function useAssociadosHook({
  supabaseId,
  teamId,
  service,
}: UseAssociadosHookProps): IAssociadosState & IAssociadosActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AssociadosData | null>(null);
  const [filters, setFiltersState] = useState<AssociadosFiltersState>({
    search: "",
    associateAccountId: "",
    teamId: "",
    closerId: "",
    page: 1,
    pageSize: 20,
  });
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    if (!teamId) return;
    try {
      setIsLoading(true);
      setError(null);
      const result = await service.listProposals(supabaseId, teamId, filters);
      setData(result);
    } catch (loadError) {
      console.error("[useAssociadosHook] Error:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar propostas");
    } finally {
      setIsLoading(false);
    }
  }, [service, supabaseId, teamId, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const setFilters = useCallback((patch: Partial<AssociadosFiltersState>) => {
    setFiltersState((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  }, []);

  const openLead = useCallback((leadId: string) => {
    setSelectedLeadId(leadId);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedLeadId(null);
  }, []);

  const criticize = useCallback(
    async (input: { title: string; message: string }) => {
      if (!teamId || !selectedLeadId) return;
      await service.criticize(supabaseId, teamId, selectedLeadId, input);
      await load();
    },
    [service, supabaseId, teamId, selectedLeadId, load]
  );

  const registerSale = useCallback(
    async (input: { operatorName: string; proposalNumber?: string; notes?: string }) => {
      if (!teamId || !selectedLeadId) return;
      await service.registerSale(supabaseId, teamId, selectedLeadId, input);
      closeDrawer();
      await load();
    },
    [service, supabaseId, teamId, selectedLeadId, load, closeDrawer]
  );

  return {
    isLoading,
    error,
    data,
    filters,
    selectedLeadId,
    drawerOpen,
    load,
    setFilters,
    openLead,
    closeDrawer,
    criticize,
    registerSale,
  };
}
