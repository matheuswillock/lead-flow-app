"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePollingWithCap } from "@/lib/polling/usePollingWithCap";
import { checkoutReturnService } from "../services/CheckoutReturnService";
import { isPaidPaymentStatus, readPaymentReference, resolveInitialCheckoutReturnStatus } from "../utils/checkoutReturnStatus";
import type { CheckoutReturnState } from "./CheckoutReturnTypes";

type PollOutcome = { status: string | null } | null;

type Action = { type: "SET_CONFIRMED" } | { type: "SET_PROCESSING" };

function reducer(state: CheckoutReturnState, action: Action): CheckoutReturnState {
  switch (action.type) {
    case "SET_CONFIRMED":
      return { status: "confirmed" };
    case "SET_PROCESSING":
      return { status: "processing" };
    default:
      return state;
  }
}

interface CheckoutReturnContextValue {
  state: CheckoutReturnState;
  goToLogin: () => void;
}

const CheckoutReturnContext = createContext<CheckoutReturnContextValue | null>(null);

export function CheckoutReturnProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentReference = readPaymentReference(searchParams);
  const fetchInflightRef = useRef(false);

  const [state, dispatch] = useReducer(
    reducer,
    paymentReference,
    (reference) => ({ status: resolveInitialCheckoutReturnStatus(reference) })
  );

  // DA1/P1-3: nunca afirma "confirmado" sem consultar — `checking` só sai
  // desse estado quando o poll efetivamente responde pago.
  const poll = useCallback(async (): Promise<PollOutcome> => {
    if (!paymentReference || fetchInflightRef.current) return null;
    fetchInflightRef.current = true;
    try {
      const lookup = await checkoutReturnService.getPaymentStatus(paymentReference);
      if (isPaidPaymentStatus(lookup.status)) {
        dispatch({ type: "SET_CONFIRMED" });
      }
      return lookup;
    } catch {
      return null;
    } finally {
      fetchInflightRef.current = false;
    }
  }, [paymentReference]);

  const isTerminal = useCallback((outcome: PollOutcome) => isPaidPaymentStatus(outcome?.status), []);

  const { capReached } = usePollingWithCap({ enabled: state.status === "checking", poll, isTerminal });

  useEffect(() => {
    // Teto sem confirmação (DA3): sai de "verificando" para o honesto
    // "processando" — nunca spinner eterno, nunca "confirmado" inventado.
    if (capReached) dispatch({ type: "SET_PROCESSING" });
  }, [capReached]);

  const goToLogin = useCallback(() => {
    router.push("/sign-in");
  }, [router]);

  const value = useMemo<CheckoutReturnContextValue>(() => ({ state, goToLogin }), [state, goToLogin]);

  return <CheckoutReturnContext.Provider value={value}>{children}</CheckoutReturnContext.Provider>;
}

export function useCheckoutReturnContext(): CheckoutReturnContextValue {
  const context = useContext(CheckoutReturnContext);
  if (!context) {
    throw new Error("useCheckoutReturnContext must be used within CheckoutReturnProvider");
  }
  return context;
}
