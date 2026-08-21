"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publicScheduleShareService } from "../services/PublicScheduleShareService";
import type {
  IPublicScheduleShareActions,
  IPublicScheduleShareState,
} from "./PublicScheduleShareTypes";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";

export function usePublicScheduleShare(
  token: string
): IPublicScheduleShareState & IPublicScheduleShareActions {
  const [state, setState] = useState<IPublicScheduleShareState>({
    token,
    status: "loading",
    data: null,
    error: null,
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
    void refresh();
    return () => {
      clearRetry();
    };
  }, [clearRetry, refresh]);

  return {
    ...state,
    refresh,
  };
}
