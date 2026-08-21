"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicScheduleShareService } from "../services/PublicScheduleShareService";
import type {
  IPublicScheduleShareActions,
  IPublicScheduleShareState,
} from "./PublicScheduleShareTypes";
import type { PublicScheduleShareData } from "../services/IPublicScheduleShareService";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";

export function usePublicScheduleShare(
  token: string,
  initialData?: PublicScheduleShareData | null,
): IPublicScheduleShareState & IPublicScheduleShareActions {
  const [state, setState] = useState<IPublicScheduleShareState>(() => {
    if (initialData) {
      return { token, status: "ready", data: initialData, error: null };
    }
    return { token, status: "loading", data: null, error: null };
  });
  const retryTimeoutRef = useRef<number | null>(null);

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, status: prev.data ? prev.status : "loading", error: null }));

    try {
      const data = await publicScheduleShareService.getSchedule(token);
      setState({
        token,
        status: "ready",
        data,
        error: null,
      });

      clearRetry();
      if (!data.joinAllowed) {
        const availableAtMs = new Date(data.availableAt).getTime();
        const now = Date.now();
        const retryInMs = Math.max(5_000, Math.min(30_000, availableAtMs - now));
        retryTimeoutRef.current = window.setTimeout(() => {
          void refresh();
        }, retryInMs);
      }
    } catch (error) {
      clearRetry();
      setState({
        token,
        status: "error",
        data: null,
        error: toUserToastMessage(error),
      });
    }
  }, [clearRetry, token]);

  useEffect(() => {
    // Se já temos dados pré-carregados pelo Server Component, agenda apenas o retry
    // para quando o agendamento ainda não estiver disponível (joinAllowed === false).
    if (initialData) {
      if (!initialData.joinAllowed) {
        const availableAtMs = new Date(initialData.availableAt).getTime();
        const now = Date.now();
        const retryInMs = Math.max(5_000, Math.min(30_000, availableAtMs - now));
        retryTimeoutRef.current = window.setTimeout(() => {
          void refresh();
        }, retryInMs);
      }
      return () => { clearRetry(); };
    }
    void refresh();
    return () => {
      clearRetry();
    };
  // Correct deps: on mount only. `initialData` comes from the Server Component
  // (stable), `refresh` and `clearRetry` are stable callbacks.
  }, [initialData, refresh, clearRetry]);

  return {
    ...state,
    refresh,
  };
}
