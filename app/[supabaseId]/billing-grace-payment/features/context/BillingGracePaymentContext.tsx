'use client';

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useParams } from "next/navigation";
import type { IBillingGracePaymentContext } from "./BillingGracePaymentTypes";
import { useBillingGracePaymentHook } from "./BillingGracePaymentHook";
import { BillingGracePaymentService } from "../services/BillingGracePaymentService";

const BillingGracePaymentContext = createContext<IBillingGracePaymentContext | undefined>(undefined);

export function BillingGracePaymentProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  const service = useMemo(() => new BillingGracePaymentService(), []);
  const state = useBillingGracePaymentHook({ supabaseId, service });

  return (
    <BillingGracePaymentContext.Provider value={state}>
      {children}
    </BillingGracePaymentContext.Provider>
  );
}

export function useBillingGracePaymentContext(): IBillingGracePaymentContext {
  const context = useContext(BillingGracePaymentContext);
  if (!context) {
    throw new Error("useBillingGracePaymentContext must be used inside BillingGracePaymentProvider");
  }
  return context;
}
