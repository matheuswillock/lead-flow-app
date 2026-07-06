import type { IAutomationsService } from "../services/IAutomationsService";
import { automationsService } from "../services/AutomationsService";
import type {
  AutomationRule,
  AutomationRuleFormInput,
  AutomationRunsPage,
} from "./AutomationsTypes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { toast } from "sonner";

export function useAutomationsHook(service: IAutomationsService = automationsService) {
  const { activeTeam } = useTeamContext();
  const { user } = useUserContext();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationLock, setMutationLock] = useState(false);
  const lastFetchKeyRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  const teamId = activeTeam?.id;
  const supabaseId = user?.id;

  const fetchRules = useCallback(async () => {
    if (!supabaseId || !teamId) return;
    const key = `${supabaseId}:${teamId}`;
    if (inFlightRef.current || lastFetchKeyRef.current === key) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const data = await service.listRules(supabaseId, teamId);
      setRules(data);
      lastFetchKeyRef.current = key;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar automações");
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [service, supabaseId, teamId]);

  useEffect(() => {
    lastFetchKeyRef.current = null;
    void fetchRules();
  }, [fetchRules]);

  const withMutationLock = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      if (mutationLock) return null;
      setMutationLock(true);
      try {
        return await action();
      } finally {
        setMutationLock(false);
      }
    },
    [mutationLock]
  );

  const createRule = useCallback(
    async (input: AutomationRuleFormInput) => {
      if (!supabaseId || !teamId) return false;
      return withMutationLock(async () => {
        await service.createRule(supabaseId, teamId, input);
        toast.success("Automação criada com sucesso");
        lastFetchKeyRef.current = null;
        await fetchRules();
        return true;
      });
    },
    [fetchRules, service, supabaseId, teamId, withMutationLock]
  );

  const updateRule = useCallback(
    async (ruleId: string, input: Partial<AutomationRuleFormInput>) => {
      if (!supabaseId || !teamId) return false;
      return withMutationLock(async () => {
        await service.updateRule(supabaseId, teamId, ruleId, input);
        toast.success("Automação atualizada com sucesso");
        lastFetchKeyRef.current = null;
        await fetchRules();
        return true;
      });
    },
    [fetchRules, service, supabaseId, teamId, withMutationLock]
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      if (!supabaseId || !teamId) return false;
      return withMutationLock(async () => {
        await service.deleteRule(supabaseId, teamId, ruleId);
        toast.success("Automação removida");
        lastFetchKeyRef.current = null;
        await fetchRules();
        return true;
      });
    },
    [fetchRules, service, supabaseId, teamId, withMutationLock]
  );

  const toggleRule = useCallback(
    async (ruleId: string, isEnabled: boolean) => {
      if (!supabaseId || !teamId) return false;
      return withMutationLock(async () => {
        await service.toggleRule(supabaseId, teamId, ruleId, isEnabled);
        toast.success(isEnabled ? "Automação habilitada" : "Automação desabilitada");
        lastFetchKeyRef.current = null;
        await fetchRules();
        return true;
      });
    },
    [fetchRules, service, supabaseId, teamId, withMutationLock]
  );

  const fetchRuns = useCallback(
    async (ruleId: string, page = 1) => {
      if (!supabaseId || !teamId) return null;
      return service.listRuns(supabaseId, teamId, ruleId, page);
    },
    [service, supabaseId, teamId]
  );

  return {
    rules,
    isLoading,
    error,
    mutationLock,
    refetch: fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    fetchRuns,
  };
}

export type AutomationsContextValue = ReturnType<typeof useAutomationsHook> & {
  fetchRuns: (ruleId: string, page?: number) => Promise<AutomationRunsPage | null>;
};
