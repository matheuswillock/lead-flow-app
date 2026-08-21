"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import type { LeadStatus } from "@prisma/client";
import type { LeadTransitionFieldKey } from "@/lib/leadStatusTransitionFields";
import type { IBackofficeLeadStatusTransitionRulesService } from "../services/IBackofficeLeadStatusTransitionRulesService";
import type { BackofficeLeadStatusTransitionRulesContextValue } from "./BackofficeLeadStatusTransitionRulesTypes";
import { useBackofficeLeadStatusTransitionRulesHook } from "./BackofficeLeadStatusTransitionRulesHook";
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext";

const BackofficeLeadStatusTransitionRulesContext = createContext<
  BackofficeLeadStatusTransitionRulesContextValue | undefined
>(undefined);

export function BackofficeLeadStatusTransitionRulesProvider({
  children,
  service,
}: {
  children: ReactNode;
  service: IBackofficeLeadStatusTransitionRulesService;
}) {
  const { user } = useBackofficeUser();
  const canManage = !user?.isOperator;
  const { state, refresh, setSaving } = useBackofficeLeadStatusTransitionRulesHook(service);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveForTargetStatus = useCallback(
    async (targetStatus: LeadStatus, fieldKeys: LeadTransitionFieldKey[]) => {
      if (!canManage) {
        toast.error("Apenas masters podem alterar regras de transição.");
        return false;
      }

      setSaving(true);
      try {
        const result = await service.saveForTargetStatus(targetStatus, fieldKeys);
        if (!result.isValid) {
          toast.error(result.errorMessages?.[0] ?? "Erro ao salvar regras");
          return false;
        }

        await refresh();
        toast.success("Regras salvas com sucesso.");
        return true;
      } catch (error) {
        toastUserError(error);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [canManage, refresh, service, setSaving]
  );

  const value = useMemo<BackofficeLeadStatusTransitionRulesContextValue>(
    () => ({
      ...state,
      refresh,
      saveForTargetStatus,
    }),
    [refresh, saveForTargetStatus, state]
  );

  return (
    <BackofficeLeadStatusTransitionRulesContext.Provider value={value}>
      {children}
    </BackofficeLeadStatusTransitionRulesContext.Provider>
  );
}

export function useBackofficeLeadStatusTransitionRules() {
  const context = useContext(BackofficeLeadStatusTransitionRulesContext);
  if (!context) {
    throw new Error(
      "useBackofficeLeadStatusTransitionRules must be used within BackofficeLeadStatusTransitionRulesProvider"
    );
  }
  return context;
}
