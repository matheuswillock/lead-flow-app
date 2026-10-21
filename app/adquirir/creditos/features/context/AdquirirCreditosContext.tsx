"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { toUserToastMessage } from "@/lib/ui/to-user-toast-message";
import type { IAdquirirCreditosService } from "../services/IAdquirirCreditosService";
import { AdquirirCreditosService } from "../services/AdquirirCreditosService";
import type {
  AdquirirCreditosContextValue,
  CreditPlan,
} from "./AdquirirCreditosTypes";

const AdquirirCreditosContext = createContext<AdquirirCreditosContextValue | null>(null);

export function AdquirirCreditosProvider({ children }: { children: ReactNode }) {
  const service = useMemo<IAdquirirCreditosService>(() => new AdquirirCreditosService(), []);
  const [pendingPlan, setPendingPlan] = useState<CreditPlan | null>(null);
  const submitInFlight = useRef(false);

  const handleActivate = useCallback(
    async (plan: CreditPlan) => {
      if (submitInFlight.current) return;

      submitInFlight.current = true;
      setPendingPlan(plan);

      try {
        const result = await service.iniciarCompra({ plan });
        toast.success("Redirecionando para o pagamento...");
        window.location.assign(result.checkoutUrl);
      } catch (error) {
        toast.error(toUserToastMessage(error));
        setPendingPlan(null);
        submitInFlight.current = false;
      }
    },
    [service],
  );

  return (
    <AdquirirCreditosContext.Provider value={{ pendingPlan, handleActivate }}>
      {children}
    </AdquirirCreditosContext.Provider>
  );
}

export function useAdquirirCreditosContext(): AdquirirCreditosContextValue {
  const context = useContext(AdquirirCreditosContext);
  if (!context) {
    throw new Error("useAdquirirCreditosContext must be used within AdquirirCreditosProvider");
  }
  return context;
}
