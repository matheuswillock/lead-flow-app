"use client";

import { useCallback, useRef, useState } from "react";
import type { IBackofficeRadarOutboxThroughputService } from "../services/IBackofficeRadarOutboxThroughputService";
import type {
  BackofficeRadarOutboxThroughputHookResult,
  BackofficeRadarOutboxThroughputState,
} from "./BackofficeRadarOutboxThroughputTypes";

const initialState: BackofficeRadarOutboxThroughputState = {
  snapshot: null,
  isLoading: true,
  isSaving: false,
  error: null,
};

export function useBackofficeRadarOutboxThroughputHook(
  service: IBackofficeRadarOutboxThroughputService
): BackofficeRadarOutboxThroughputHookResult {
  const [state, setState] = useState<BackofficeRadarOutboxThroughputState>(initialState);
  const inFlightRef = useRef(false);
  const lastSuccessKeyRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const requestKey = "radar-outbox-throughput";
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const snapshot = await service.get();
      lastSuccessKeyRef.current = requestKey;
      setState((prev) => ({
        ...prev,
        snapshot,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Erro ao carregar vazão",
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, [service]);

  const setSaving = useCallback((value: boolean) => {
    setState((prev) => ({ ...prev, isSaving: value }));
  }, []);

  return { state, refresh, setSaving, service };
}
