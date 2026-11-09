"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { isPixExpired } from "@/components/public-checkout/pixExpiry"
import { usePublicAdhesion } from "./PublicAdhesionHook"
import type { PublicAdhesionCheckoutInput } from "./PublicAdhesionTypes"

const POLL_INTERVAL_MS = 8000
const STILL_PENDING_NOTICE_MS = 8000

/**
 * Gera o pagamento de um pedido recém-criado com os dados já preenchidos: assim que a adesão
 * carrega, envia o PIX ou o cartão uma única vez e acompanha a confirmação a cada poucos segundos.
 * Precisa estar dentro de `PublicAdhesionProvider`.
 */
export function useAdhesionAutoPayment(input: PublicAdhesionCheckoutInput, onPaid: () => void) {
  const { details, payment, isSubmitting, isLoading, error, submitCheckout, refreshPaymentStatus } =
    usePublicAdhesion()
  const started = useRef(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  // Momento da última consulta pedida pelo cliente ("Já paguei"), para dar retorno visível.
  const [lastManualCheckAt, setLastManualCheckAt] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const isPaid = payment?.status === "paid" || details?.status === "paid"
  const pixExpired = Boolean(
    details?.pixProvider === "ABACATE_PAY" &&
      payment?.status === "pending" &&
      isPixExpired(payment.pix?.expirationDate, now),
  )

  const pay = useCallback(async () => {
    setFailure(null)
    try {
      await submitCheckout(input)
    } catch (submitError) {
      // A tela de falha já mostra o motivo; um aviso flutuante repetiria a mesma mensagem.
      setFailure(submitError instanceof Error ? submitError.message : "Não foi possível gerar o pagamento.")
    }
  }, [input, submitCheckout])

  useEffect(() => {
    if (!details || started.current) return
    started.current = true
    void pay()
  }, [details, pay])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isPaid) onPaid()
  }, [isPaid, onPaid])

  useEffect(() => {
    if (!payment || isPaid || pixExpired) return
    if (payment.status === "canceled" || payment.status === "expired") return
    const refresh = () => void refreshPaymentStatus({ sync: true }).catch(() => undefined)
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [isPaid, payment, pixExpired, refreshPaymentStatus])

  const validate = useCallback(async () => {
    if (isValidating) return
    setIsValidating(true)
    try {
      await refreshPaymentStatus({ sync: true })
      setLastManualCheckAt(Date.now())
    } catch (refreshError) {
      toast.error(refreshError instanceof Error ? refreshError.message : "Não foi possível validar agora.")
    } finally {
      setIsValidating(false)
    }
  }, [isValidating, refreshPaymentStatus])

  return {
    payment,
    isPreparing: !payment && !failure && !error && (isLoading || isSubmitting || !started.current),
    isSubmitting,
    failure: failure ?? (payment ? null : error),
    pixExpired,
    isValidating,
    /** Verdadeiro por alguns segundos depois de uma consulta manual que ainda não achou o pagamento. */
    stillPendingAfterCheck:
      !isPaid && lastManualCheckAt != null && now - lastManualCheckAt < STILL_PENDING_NOTICE_MS,
    now,
    pay,
    validate,
  }
}
