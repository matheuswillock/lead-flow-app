"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  AddOnCheckoutData,
  AddOnCheckoutState,
  AddOnCheckoutStep,
  AddOnCheckoutSubmitInput,
  PaymentStatus,
} from "./AddOnCheckoutTypes";
import { initialState } from "./AddOnCheckoutTypes";
import { addOnCheckoutService } from "../services/AddOnCheckoutService";

type Action =
  | { type: "SET_LOADING" }
  | { type: "SET_DATA"; payload: AddOnCheckoutData }
  | { type: "SET_ERROR"; payload: string }
  | { type: "SET_PAYMENT_METHOD"; payload: "PIX" | "CREDIT_CARD" }
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "SET_PAYMENT_DATA"; payload: any }
  | { type: "SET_PAYMENT_STATUS"; payload: PaymentStatus }
  | { type: "SET_STEP"; payload: AddOnCheckoutStep }
  | { type: "RESET" };

function reducer(state: AddOnCheckoutState, action: Action): AddOnCheckoutState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, step: "loading", error: undefined };
    case "SET_DATA":
      return {
        ...state,
        data: action.payload,
        selectedPaymentMethod: action.payload.presetBillingType,
        step: action.payload.alreadyPaid ? "success" : "idle",
      };
    case "SET_ERROR":
      return { ...state, step: "error", error: action.payload };
    case "SET_PAYMENT_METHOD":
      return { ...state, selectedPaymentMethod: action.payload };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    case "SET_PAYMENT_DATA":
      return { ...state, paymentData: action.payload };
    case "SET_PAYMENT_STATUS":
      return { ...state, paymentStatus: action.payload };
    case "SET_STEP":
      return { ...state, step: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface AddOnCheckoutContextType {
  state: AddOnCheckoutState;
  fetchCheckoutData: (pendingActionId: string) => Promise<void>;
  setSelectedPaymentMethod: (method: "PIX" | "CREDIT_CARD") => void;
  submitPayment: (input: AddOnCheckoutSubmitInput) => Promise<void>;
  refreshPaymentStatus: () => Promise<void>;
  clearPolling: () => void;
}

export const AddOnCheckoutContext = createContext<AddOnCheckoutContextType | undefined>(
  undefined
);

export function AddOnCheckoutProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pollingIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const fetchInflightRef = useRef(false);

  const setSelectedPaymentMethod = useCallback((method: "PIX" | "CREDIT_CARD") => {
    dispatch({ type: "SET_PAYMENT_METHOD", payload: method });
  }, []);

  const clearPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = undefined;
    }
  }, []);

  const startPolling = useCallback(
    (pendingActionId: string) => {
      clearPolling();
      const intervalId = setInterval(async () => {
        try {
          const status = await addOnCheckoutService.checkPaymentStatus(pendingActionId);
          dispatch({ type: "SET_PAYMENT_STATUS", payload: status });
          if (status.pendingActionStatus === "applied") {
            dispatch({ type: "SET_STEP", payload: "success" });
            clearInterval(intervalId);
            pollingIntervalRef.current = undefined;
          }
        } catch (error) {
          console.error("Error polling payment status:", error);
        }
      }, 4000);
      pollingIntervalRef.current = intervalId;
    },
    [clearPolling]
  );

  const fetchCheckoutData = useCallback(
    async (pendingActionId: string) => {
      if (fetchInflightRef.current) return;
      fetchInflightRef.current = true;
      dispatch({ type: "SET_LOADING" });
      try {
        const data = await addOnCheckoutService.fetchCheckoutData(pendingActionId);
        dispatch({ type: "SET_DATA", payload: data });
        if (data.paymentId && data.status === "pending" && !data.alreadyPaid) {
          startPolling(pendingActionId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao carregar dados";
        dispatch({ type: "SET_ERROR", payload: message });
      } finally {
        fetchInflightRef.current = false;
      }
    },
    [startPolling]
  );

  const submitPayment = useCallback(
    async (input: AddOnCheckoutSubmitInput) => {
      if (!state.data?.pendingActionId) return;

      dispatch({ type: "SET_PROCESSING", payload: true });
      try {
        const paymentData = await addOnCheckoutService.createPayment(
          state.data.pendingActionId,
          input
        );
        dispatch({ type: "SET_PAYMENT_DATA", payload: paymentData });
        dispatch({ type: "SET_STEP", payload: "payment" });
        startPolling(state.data.pendingActionId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao criar pagamento";
        throw new Error(message);
      } finally {
        dispatch({ type: "SET_PROCESSING", payload: false });
      }
    },
    [state.data?.pendingActionId, startPolling]
  );

  const refreshPaymentStatus = useCallback(async () => {
    if (!state.data?.pendingActionId) return;
    try {
      const status = await addOnCheckoutService.checkPaymentStatus(state.data.pendingActionId);
      dispatch({ type: "SET_PAYMENT_STATUS", payload: status });
      if (status.pendingActionStatus === "applied") {
        dispatch({ type: "SET_STEP", payload: "success" });
      }
    } catch (error) {
      console.error("Error refreshing payment status:", error);
    }
  }, [state.data?.pendingActionId]);

  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  return (
    <AddOnCheckoutContext.Provider
      value={{
        state,
        fetchCheckoutData,
        setSelectedPaymentMethod,
        submitPayment,
        refreshPaymentStatus,
        clearPolling,
      }}
    >
      {children}
    </AddOnCheckoutContext.Provider>
  );
}
