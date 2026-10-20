'use client';

import { useCallback, useEffect, useState } from "react";
import type { IBillingGracePaymentActions, IBillingGracePaymentState } from "./BillingGracePaymentTypes";
import { BillingGracePaymentService } from "../services/BillingGracePaymentService";

interface UseBillingGracePaymentHookProps {
  supabaseId: string;
  service: BillingGracePaymentService;
}

export function useBillingGracePaymentHook({
  supabaseId,
  service,
}: UseBillingGracePaymentHookProps): IBillingGracePaymentState & IBillingGracePaymentActions {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<IBillingGracePaymentState["quote"]>(null)
  const [payment, setPayment] = useState<IBillingGracePaymentState["payment"]>(null)

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setQuote(await service.getQuote(supabaseId));
    } catch (loadError) {
      console.error("[useBillingGracePaymentHook] Error:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [service, supabaseId]);

  const createPayment = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const created = await service.createPayment(supabaseId, `billing-grace:${supabaseId}:${Date.now()}`)
      setPayment(created)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível iniciar o pagamento")
    } finally {
      setIsLoading(false)
    }
  }, [service, supabaseId])

  useEffect(() => {
    if (!payment || payment.status === "completed" || payment.status === "failed") return
    const timer = window.setInterval(async () => {
      try { setPayment(await service.getPayment(supabaseId, payment.id)) } catch { /* retry on next tick */ }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [payment, service, supabaseId])

  return { isLoading, error, quote, payment, load, createPayment };
}
