"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePollingWithCap } from "@/lib/polling/usePollingWithCap";
import { checkoutReturnService } from "../services/CheckoutReturnService";
import {
  readPaymentReference,
  resolveCheckoutReturnStatusFromPayment,
  resolveInitialCheckoutReturnStatus,
  type CheckoutReturnStatus,
} from "../utils/checkoutReturnStatus";
import type { CheckoutReturnState } from "./CheckoutReturnTypes";

type PollOutcome = { status: string | null } | null;

type Action = { type: "SET_STATUS"; payload: CheckoutReturnStatus };

function reducer(state: CheckoutReturnState, action: Action): CheckoutReturnState {
  switch (action.type) {
    case "SET_STATUS":
      return { status: action.payload };
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
  // desse estado quando o poll efetivamente resolve pago ou falha terminal.
  const poll = useCallback(async (): Promise<PollOutcome> => {
    if (!paymentReference || fetchInflightRef.current) return null;
    fetchInflightRef.current = true;
    try {
      const lookup = await checkoutReturnService.getPaymentStatus(paymentReference);
      const resolved = resolveCheckoutReturnStatusFromPayment(lookup.status);
      if (resolved) dispatch({ type: "SET_STATUS", payload: resolved });
      return lookup;
    } catch {
      return null;
    } finally {
      fetchInflightRef.current = false;
    }
  }, [paymentReference]);

  const isTerminal = useCallback(
    (outcome: PollOutcome) => resolveCheckoutReturnStatusFromPayment(outcome?.status) !== null,
    []
  );

  const { capReached } = usePollingWithCap({ enabled: state.status === "checking", poll, isTerminal });

  useEffect(() => {
    // Teto sem desfecho (DA3): sai de "verificando" para o honesto
    // "processando" — nunca spinner eterno, nunca "confirmado" inventado.
    if (capReached) dispatch({ type: "SET_STATUS", payload: "processing" });
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
