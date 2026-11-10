'use client';

import { useCallback, useEffect, useState } from "react";
import type {
  BillingGraceCardInput,
  IBillingGracePaymentActions,
  IBillingGracePaymentState,
} from "./BillingGracePaymentTypes";
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

  const createPayment = useCallback(async (cycle: string, keptUserIds: string[]) => {
    try {
      setIsLoading(true)
      setError(null)
      const created = await service.createPayment(supabaseId, `billing-grace:${supabaseId}:${Date.now()}`, cycle, keptUserIds)
      setPayment(created)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível iniciar o pagamento")
    } finally {
      setIsLoading(false)
    }
  }, [service, supabaseId])

  const createCardPayment = useCallback(async (input: BillingGraceCardInput) => {
    try {
      setIsLoading(true)
      setError(null)
      const created = await service.createCardPayment(supabaseId, `billing-grace-card:${supabaseId}:${Date.now()}`, input)
      setPayment(created)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Não foi possível cobrar o cartão")
    } finally {
      setIsLoading(false)
    }
  }, [service, supabaseId])

  const resetPayment = useCallback(() => {
    setPayment(null)
    setError(null)
  }, [])

  /** "Já paguei": consulta o status na hora, sem esperar a próxima verificação automática. */
  const refreshPayment = useCallback(async () => {
    if (!payment) return
    try {
      setPayment(await service.getPayment(supabaseId, payment.id))
    } catch {
      // a verificação automática tenta de novo em seguida
    }
  }, [payment, service, supabaseId])

  useEffect(() => {
    if (!payment || payment.status === "completed" || payment.status === "failed") return
    const timer = window.setInterval(async () => {
      try { setPayment(await service.getPayment(supabaseId, payment.id)) } catch { /* retry on next tick */ }
    }, 5000)
    return () => window.clearInterval(timer)
  }, [payment, service, supabaseId])

  return { isLoading, error, quote, payment, load, createPayment, createCardPayment, refreshPayment, resetPayment };
}
