import { useCallback, useState } from "react";
import type { IBackofficeRadarEngagementService } from "../services/IBackofficeRadarEngagementService";
import type { BackofficeRadarEngagementState } from "./BackofficeRadarEngagementTypes";

const initialState: BackofficeRadarEngagementState = {
  weights: [],
  config: null,
  isLoading: true,
  isSavingWeights: false,
  isSavingConfig: false,
  error: null,
};

export function useBackofficeRadarEngagementHook(service: IBackofficeRadarEngagementService) {
  const [state, setState] = useState<BackofficeRadarEngagementState>(initialState);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const [weights, config] = await Promise.all([service.listWeights(), service.getConfig()]);
      setState((prev) => ({
        ...prev,
        weights,
        config,
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

  return {
    state,
    refresh,
    setSavingWeights,
    setSavingConfig,
  };
}
