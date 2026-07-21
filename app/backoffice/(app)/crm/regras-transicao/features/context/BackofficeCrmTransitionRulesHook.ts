"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BackofficeLeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import { toast } from "sonner";
import type {
  BackofficeCrmTransitionRulesContextValue,
} from "./BackofficeCrmTransitionRulesTypes";
import type { UseBackofficeCrmTransitionRulesParams } from "../services/IBackofficeCrmTransitionRulesService";

export function useBackofficeCrmTransitionRules({
  service,
}: UseBackofficeCrmTransitionRulesParams): BackofficeCrmTransitionRulesContextValue {
  const [rules, setRules] = useState<BackofficeCrmTransitionRulesContextValue["rules"]>([]);
  const [availableFieldKeys, setAvailableFieldKeys] = useState<LeadTransitionFieldKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setError(null);
    try {
      const result = await service.list();
      setRules(result.rules);
      setAvailableFieldKeys(result.availableFieldKeys);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar regras";
      setError(message);
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveForTargetStatus = useCallback(
    async (targetStatus: BackofficeLeadStatus, fieldKeys: LeadTransitionFieldKey[]) => {
      setIsSaving(true);
      try {
        const output = await service.saveForTargetStatus(targetStatus, fieldKeys);
        if (!output.isValid) {
          toast.error(output.errorMessages?.[0] ?? "Erro ao salvar regras");
          return output;
        }
        toast.success("Regras salvas com sucesso.");
        await refresh();
        return output;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao salvar regras");
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [refresh, service]
  );

  return useMemo(
    () => ({
      rules,
      availableFieldKeys,
      isLoading,
      isSaving,
      error,
      refresh,
      saveForTargetStatus,
    }),
    [availableFieldKeys, error, isLoading, isSaving, refresh, rules, saveForTargetStatus]
  );
}
