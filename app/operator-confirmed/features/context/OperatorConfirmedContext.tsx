"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePollingWithCap } from "@/lib/polling/usePollingWithCap";
import { isOperatorProvisioningTerminal, isPollFailureTerminal, type PollFailureReason } from "../utils/operatorProvisioning";
import { operatorConfirmedService } from "../services/OperatorConfirmedService";
import { initialOperatorConfirmedState, type OperatorConfirmedState, type PendingOperatorData } from "./OperatorConfirmedTypes";

type PollOutcome =
  | { ok: true; data: PendingOperatorData }
  | { ok: false; reason: PollFailureReason };

type Action =
  | { type: "SET_LOADING" }
  | { type: "SET_DATA"; payload: PendingOperatorData }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_POLL_CAPPED"; payload: boolean };

function reducer(state: OperatorConfirmedState, action: Action): OperatorConfirmedState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, step: "loading", error: null };
    case "SET_DATA":
      return { ...state, step: "ready", operatorData: action.payload, error: null, pollCapped: false };
    case "SET_ERROR":
      return { ...state, step: "error", error: action.payload };
    case "SET_POLL_CAPPED":
      return { ...state, pollCapped: action.payload };
    default:
      return state;
  }
}

interface OperatorConfirmedContextValue {
  state: OperatorConfirmedState;
  /** Refaz a busca do zero — usado tanto no erro (P2-7) quanto no teto do polling (DA3). */
  retryFetch: () => void;
  goToLogin: () => void;
  goToDashboard: () => void;
}

const OperatorConfirmedContext = createContext<OperatorConfirmedContextValue | null>(null);

export function OperatorConfirmedProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingOperatorId = searchParams.get("id");

  const [state, dispatch] = useReducer(reducer, initialOperatorConfirmedState);
  const fetchInflightRef = useRef(false);

  const poll = useCallback(async (): Promise<PollOutcome> => {
    if (!pendingOperatorId) {
      dispatch({ type: "SET_ERROR", payload: "ID do operador não fornecido" });
      return { ok: false, reason: "missing-id" };
    }

    if (fetchInflightRef.current) return { ok: false, reason: "in-flight" };
    fetchInflightRef.current = true;

    try {
      const data = await operatorConfirmedService.fetchOperatorData(pendingOperatorId);
      dispatch({ type: "SET_DATA", payload: data });
      return { ok: true, data };
    } catch (error) {
      dispatch({
        type: "SET_ERROR",
        payload: error instanceof Error ? error.message : "Erro ao buscar informações do operador",
      });
      // Achado P2 da revisão do PR #1207 (thread PRRT_...ZZPv): rede caída
      // ou 5xx passageiro não é desfecho — o polling com teto tenta de novo
      // antes de empurrar o usuário para o erro manual.
      return { ok: false, reason: "transient" };
    } finally {
      fetchInflightRef.current = false;
    }
  }, [pendingOperatorId]);

  const isTerminal = useCallback((outcome: PollOutcome) => {
    if (!outcome.ok) return isPollFailureTerminal(outcome.reason);
    return isOperatorProvisioningTerminal(outcome.data);
  }, []);

  const { capReached, restart } = usePollingWithCap({ enabled: true, poll, isTerminal });

  useEffect(() => {
    dispatch({ type: "SET_POLL_CAPPED", payload: capReached });
  }, [capReached]);

  const retryFetch = useCallback(() => {
    dispatch({ type: "SET_LOADING" });
    restart();
  }, [restart]);

  const goToLogin = useCallback(() => {
    router.push("/sign-in");
  }, [router]);

  const goToDashboard = useCallback(() => {
    if (state.operatorData?.managerId) {
      router.push(`/${state.operatorData.managerId}/manager-users`);
    } else {
      router.push("/sign-in");
    }
  }, [router, state.operatorData?.managerId]);

  const value = useMemo<OperatorConfirmedContextValue>(
    () => ({ state, retryFetch, goToLogin, goToDashboard }),
    [state, retryFetch, goToLogin, goToDashboard]
  );

  return <OperatorConfirmedContext.Provider value={value}>{children}</OperatorConfirmedContext.Provider>;
}

export function useOperatorConfirmedContext(): OperatorConfirmedContextValue {
  const context = useContext(OperatorConfirmedContext);
  if (!context) {
    throw new Error("useOperatorConfirmedContext must be used within OperatorConfirmedProvider");
  }
  return context;
}
