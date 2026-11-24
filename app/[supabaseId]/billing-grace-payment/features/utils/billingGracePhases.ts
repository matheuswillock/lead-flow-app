import type { BillingGracePaymentMethod } from "../context/BillingGracePaymentTypes"

/** Fases da cobrança de carência: plano e itens, depois o pagamento. */
export const BILLING_GRACE_PHASE_LABELS = ["Plano e itens", "Pagamento"] as const
export const PLAN_PHASE = 0
export const PAYMENT_PHASE = 1

/** A fase de pagamento só abre com um prazo escolhido: sem ele não há total a cobrar. */
export function canOpenPaymentPhase(hasSelectedCycle: boolean): boolean {
  return hasSelectedCycle
}

/** Com pagamento criado, a tela fica na fase de pagamento, mesmo que o índice diga o contrário. */
export function resolveActivePhase(hasPayment: boolean, requestedIndex: number): number {
  if (hasPayment) return PAYMENT_PHASE
  return Math.min(Math.max(requestedIndex, PLAN_PHASE), PAYMENT_PHASE)
}

/** Cartão só vale quando a renovação traz o checkout do cartão; sem ele a cobrança é PIX. */
export function resolvePaymentMethod(
  requested: BillingGracePaymentMethod,
  canPayByCard: boolean,
): BillingGracePaymentMethod {
  return requested === "CREDIT_CARD" && canPayByCard ? "CREDIT_CARD" : "PIX"
}

/** Parcelas efetivas: nunca mais que o máximo do prazo escolhido. */
export function effectiveInstallments(choice: number, maxInstallments: number): number {
  return Math.max(1, Math.min(choice, maxInstallments))
}

/** Rótulo do envio, usado na lateral e na barra do celular. */
export function paymentSubmitLabel(input: {
  method: BillingGracePaymentMethod
  isBusy: boolean
  isTokenizing: boolean
}): string {
  if (input.method === "PIX") return input.isBusy ? "Gerando o QR Code..." : "Gerar QR Code PIX"
  if (input.isTokenizing) return "Validando o cartão..."
  return input.isBusy ? "Processando..." : "Pagar com cartão"
}

/** Legenda do total na barra do celular. */
export function paymentCaption(method: BillingGracePaymentMethod, installments: number): string {
  if (method === "PIX") return "à vista no PIX"
  return installments > 1 ? `em ${installments}x no cartão` : "no cartão"
}
