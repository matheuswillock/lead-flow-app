"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext";
import type {
  IBackofficeRadarEngagementService,
  UpsertFormEngagementScoreRulePayload,
  UpsertRadarEngagementConfigPayload,
  UpsertRadarEngagementWeightPayload,
} from "../services/IBackofficeRadarEngagementService";
import type { BackofficeRadarEngagementContextValue } from "./BackofficeRadarEngagementTypes";
import { useBackofficeRadarEngagementHook } from "./BackofficeRadarEngagementHook";

const BackofficeRadarEngagementContext = createContext<
  BackofficeRadarEngagementContextValue | undefined
>(undefined);

export function BackofficeRadarEngagementProvider({
  children,
  service,
}: {
  children: ReactNode;
  service: IBackofficeRadarEngagementService;
}) {
  const { user } = useBackofficeUser();
  const canManage = !user?.isOperator;
  const { state, refresh, setSavingWeights, setSavingConfig, setSavingFormRules } =
    useBackofficeRadarEngagementHook(service);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveWeights = useCallback(
    async (weights: UpsertRadarEngagementWeightPayload[]) => {
      if (!canManage) {
        toast.error("Apenas masters podem alterar pesos de engajamento.");
        return false;
      }

      setSavingWeights(true);
      try {
        const result = await service.saveWeights(weights);
        if (!result.isValid) {
          toast.error(result.errorMessages?.[0] ?? "Erro ao salvar pesos");
          return false;
        }
        await refresh();
        toast.success(result.successMessages?.[0] ?? "Pesos salvos com sucesso.");
        return true;
      } catch (error) {
        toastUserError(error);
        return false;
      } finally {
        setSavingWeights(false);
      }
    },
    [canManage, refresh, service, setSavingWeights]
  );

  const saveConfig = useCallback(
    async (payload: UpsertRadarEngagementConfigPayload) => {
      if (!canManage) {
        toast.error("Apenas masters podem alterar a configuração de engajamento.");
        return false;
      }

      setSavingConfig(true);
      try {
        const result = await service.saveConfig(payload);
        if (!result.isValid) {
          toast.error(result.errorMessages?.[0] ?? "Erro ao salvar configuração");
          return false;
        }
        await refresh();
        toast.success(result.successMessages?.[0] ?? "Configuração salva com sucesso.");
        return true;
      } catch (error) {
        toastUserError(error);
        return false;
      } finally {
        setSavingConfig(false);
      }
    },
    [canManage, refresh, service, setSavingConfig]
  );

  const saveFormScoreRules = useCallback(
    async (rules: UpsertFormEngagementScoreRulePayload[]) => {
      if (!canManage) {
        toast.error("Apenas masters podem alterar regras de score de formulário.");
        return false;
      }

      setSavingFormRules(true);
      try {
        const result = await service.saveFormScoreRules(rules);
        if (!result.isValid) {
          toast.error(result.errorMessages?.[0] ?? "Erro ao salvar regras");
          return false;
        }
        await refresh();
        toast.success(result.successMessages?.[0] ?? "Regras salvas com sucesso.");
        return true;
      } catch (error) {
        toastUserError(error);
        return false;
      } finally {
        setSavingFormRules(false);
      }
    },
    [canManage, refresh, service, setSavingFormRules]
  );

  const deleteFormScoreRule = useCallback(
    async (id: string) => {
      if (!canManage) {
        toast.error("Apenas masters podem remover regras de score de formulário.");
        return false;
      }

      setSavingFormRules(true);
      try {
        const result = await service.deleteFormScoreRule(id);
        if (!result.isValid) {
          toast.error(result.errorMessages?.[0] ?? "Erro ao remover regra");
          return false;
        }
        await refresh();
        toast.success(result.successMessages?.[0] ?? "Regra removida com sucesso.");
        return true;
      } catch (error) {
        toastUserError(error);
        return false;
      } finally {
        setSavingFormRules(false);
      }
    },
    [canManage, refresh, service, setSavingFormRules]
  );

  const value = useMemo<BackofficeRadarEngagementContextValue>(
    () => ({
      ...state,
      canManage,
      refresh,
      saveWeights,
      saveConfig,
      saveFormScoreRules,
      deleteFormScoreRule,
    }),
    [canManage, deleteFormScoreRule, refresh, saveConfig, saveFormScoreRules, saveWeights, state]
  );

  return (
    <BackofficeRadarEngagementContext.Provider value={value}>
      {children}
    </BackofficeRadarEngagementContext.Provider>
  );
}

export function useBackofficeRadarEngagement() {
  const context = useContext(BackofficeRadarEngagementContext);
  if (!context) {
    throw new Error(
      "useBackofficeRadarEngagement must be used within BackofficeRadarEngagementProvider"
    );
  }
  return context;
}
