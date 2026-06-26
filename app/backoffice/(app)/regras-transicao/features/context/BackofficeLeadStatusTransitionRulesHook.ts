"use client";

import { useCallback, useRef, useState } from "react";
import type { IBackofficeLeadStatusTransitionRulesService } from "../services/IBackofficeLeadStatusTransitionRulesService";
import type { BackofficeLeadStatusTransitionRulesState } from "./BackofficeLeadStatusTransitionRulesTypes";

const initialState: BackofficeLeadStatusTransitionRulesState = {
  rules: [],
  availableFieldKeys: [],
  isLoading: true,
  isSaving: false,
  error: null,
};

export function useBackofficeLeadStatusTransitionRulesHook(
  service: IBackofficeLeadStatusTransitionRulesService
) {
  const [state, setState] = useState<BackofficeLeadStatusTransitionRulesState>(initialState);
  const inFlightRef = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const result = await service.list();
      setState((prev) => ({
        ...prev,
        rules: result.rules,
        availableFieldKeys: result.availableFieldKeys,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Erro ao carregar regras",
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, [service]);

  const setSaving = useCallback((isSaving: boolean) => {
    setState((prev) => ({ ...prev, isSaving }));
  }, []);

  return { state, refresh, setSaving };
}
