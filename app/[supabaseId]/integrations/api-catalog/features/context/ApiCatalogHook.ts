"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTeamContext } from "@/app/context/TeamContext";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { apiResourcesService } from "../services/ApiResourcesService";
import type { ApiResourceActivation, ApiResourceUsageItem } from "../services/IApiResourcesService";
import type { ApiCatalogState } from "./ApiCatalogTypes";

/** Slug do único recurso da primeira entrega (SPEC 14): horários disponíveis. */
export const AVAILABILITY_RESOURCE_SLUG = "availability";

export function useApiCatalog(supabaseId: string): ApiCatalogState {
  const { activeTeam } = useTeamContext();
  const teamId = activeTeam?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activation, setActivation] = useState<ApiResourceActivation | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [usage, setUsage] = useState<ApiResourceUsageItem[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError(null);
    try {
      const state = await apiResourcesService.get(supabaseId, teamId, AVAILABILITY_RESOURCE_SLUG);
      setActivation(state.activation);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível carregar o recurso");
    } finally {
      setLoading(false);
    }
  }, [supabaseId, teamId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const reloadUsage = useCallback(async () => {
    if (!teamId) return;
    setUsageLoading(true);
    setUsageError(null);
    try {
      setUsage(await apiResourcesService.usage(supabaseId, teamId, AVAILABILITY_RESOURCE_SLUG));
    } catch (failure) {
      setUsageError(failure instanceof Error ? failure.message : "Não foi possível carregar as últimas consultas");
    } finally {
      setUsageLoading(false);
    }
  }, [supabaseId, teamId]);

  // Só busca o uso quando o recurso foi ativado; a chave estável evita refetch a cada renderização.
  const activationId = activation?.id ?? null;
  useEffect(() => {
    if (!activationId) {
      setUsage([]);
      return;
    }
    void reloadUsage();
  }, [activationId, reloadUsage]);

  const activate = useCallback(async () => {
    if (!teamId || pending) return;
    setPending(true);
    try {
      const result = await apiResourcesService.activate(supabaseId, teamId, AVAILABILITY_RESOURCE_SLUG);
      setActivation(result.activation);
      setRevealedToken(result.token);
      toast.success("Token gerado. Copie agora: ele não será exibido de novo.");
    } catch (failure) {
      toastUserError(failure);
    } finally {
      setPending(false);
    }
  }, [pending, supabaseId, teamId]);

  const toggleStatus = useCallback(async () => {
    if (!teamId || !activation || pending) return;
    setPending(true);
    try {
      const next = activation.status === "active" ? "inactive" : "active";
      setActivation(await apiResourcesService.setStatus(supabaseId, teamId, AVAILABILITY_RESOURCE_SLUG, next));
      toast.success(next === "active" ? "Recurso reativado" : "Recurso desativado");
    } catch (failure) {
      toastUserError(failure);
    } finally {
      setPending(false);
    }
  }, [activation, pending, supabaseId, teamId]);

  return {
    supabaseId,
    loading,
    error,
    activation,
    revealedToken,
    pending,
    activate,
    toggleStatus,
    dismissToken: () => setRevealedToken(null),
    reload,
    usage,
    usageLoading,
    usageError,
    reloadUsage,
  };
}
