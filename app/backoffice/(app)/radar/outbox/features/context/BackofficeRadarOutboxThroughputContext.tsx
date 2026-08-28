"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { toastUserError } from "@/lib/ui/to-user-toast-message";
import { useBackofficeUser } from "@/app/backoffice/context/BackofficeUserContext";
import type {
  IBackofficeRadarOutboxThroughputService,
  UpsertRadarOutboxThroughputPayload,
} from "../services/IBackofficeRadarOutboxThroughputService";
import type { BackofficeRadarOutboxThroughputContextValue } from "./BackofficeRadarOutboxThroughputTypes";
import { useBackofficeRadarOutboxThroughputHook } from "./BackofficeRadarOutboxThroughputHook";

const BackofficeRadarOutboxThroughputContext = createContext<
  BackofficeRadarOutboxThroughputContextValue | undefined
>(undefined);

export function BackofficeRadarOutboxThroughputProvider({
  children,
  service,
}: {
  children: ReactNode;
  service: IBackofficeRadarOutboxThroughputService;
}) {
  const { user } = useBackofficeUser();
  const canManage = !user?.isOperator;
  const { state, refresh, setSaving } = useBackofficeRadarOutboxThroughputHook(service);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (payload: UpsertRadarOutboxThroughputPayload) => {
      if (!canManage) {
        toast.error("Apenas masters podem alterar a vazão do outbox.");
        return false;
      }

      setSaving(true);
      try {
        const result = await service.save(payload);
        if (!result.isValid) {
          toast.error(result.errorMessages?.[0] ?? "Erro ao salvar vazão");
          return false;
        }
        await refresh();
        toast.success(result.successMessages?.[0] ?? "Vazão salva com sucesso.");
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

  const value = useMemo<BackofficeRadarOutboxThroughputContextValue>(
    () => ({
      ...state,
      canManage,
      refresh,
      save,
    }),
    [canManage, refresh, save, state]
  );

  return (
    <BackofficeRadarOutboxThroughputContext.Provider value={value}>
      {children}
    </BackofficeRadarOutboxThroughputContext.Provider>
  );
}

export function useBackofficeRadarOutboxThroughput() {
  const ctx = useContext(BackofficeRadarOutboxThroughputContext);
  if (!ctx) {
    throw new Error(
      "useBackofficeRadarOutboxThroughput must be used within BackofficeRadarOutboxThroughputProvider"
    );
  }
  return ctx;
}
