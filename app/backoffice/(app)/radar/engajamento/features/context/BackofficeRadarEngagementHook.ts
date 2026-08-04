import { useCallback, useState } from "react";
import type { IBackofficeRadarEngagementService } from "../services/IBackofficeRadarEngagementService";
import type { BackofficeRadarEngagementState } from "./BackofficeRadarEngagementTypes";

const initialState: BackofficeRadarEngagementState = {
  weights: [],
  config: null,
  formScoreRules: [],
  isLoading: true,
  isSavingWeights: false,
  isSavingConfig: false,
  isSavingFormRules: false,
  error: null,
};

export function useBackofficeRadarEngagementHook(service: IBackofficeRadarEngagementService) {
  const [state, setState] = useState<BackofficeRadarEngagementState>(initialState);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [weights, config, formScoreRules] = await Promise.all([
        service.listWeights(),
        service.getConfig(),
        service.listFormScoreRules(),
      ]);
      setState((prev) => ({
        ...prev,
        weights,
        config,
        formScoreRules,
        isLoading: false,
        error: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "Erro ao carregar engajamento do Radar",
      }));
    }
  }, [service]);

  const setSavingWeights = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isSavingWeights: value }));
  }, []);

  const setSavingConfig = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isSavingConfig: value }));
  }, []);

  const setSavingFormRules = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isSavingFormRules: value }));
  }, []);

  return {
    state,
    refresh,
    setSavingWeights,
    setSavingConfig,
    setSavingFormRules,
  };
}
