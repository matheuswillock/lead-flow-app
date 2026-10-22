import { isPaidPaymentStatus } from "@/lib/billing/payment-status-vocabulary"
import type { PaymentAttemptStatus } from "@/lib/payment-provider/types"

/** Vocabulário único do ledger de cobranças. O status bruto do provider fica à parte (`raw_status`). */
export const CHARGE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "REFUNDED",
  "REVIEW",
  "CANCELED",
] as const
export type ChargeStatus = (typeof CHARGE_STATUSES)[number]

export function isChargeStatus(value: unknown): value is ChargeStatus {
  return typeof value === "string" && (CHARGE_STATUSES as readonly string[]).includes(value)
}

const ATTEMPT_TO_CHARGE: Record<PaymentAttemptStatus, ChargeStatus> = {
  CREATED: "PENDING",
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  // Disputa é resolvida de forma operacional (decisão 17): vira revisão, nunca reembolso automático.
  DISPUTED: "REVIEW",
  EXPIRED: "EXPIRED",
  CANCELED: "CANCELED",
  // Resultado indeterminado precisa de reconciliação, não de nova cobrança.
  UNKNOWN: "REVIEW",
}

export function chargeStatusFromAttempt(status: PaymentAttemptStatus): ChargeStatus {
  return ATTEMPT_TO_CHARGE[status]
}

const ASAAS_PENDING = new Set(["PENDING", "AWAITING_RISK_ANALYSIS", "BANK_PROCESSING"])
const ASAAS_REFUNDED = new Set(["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS"])
const ASAAS_REVIEW = new Set([
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
])
const ASAAS_CANCELED = new Set(["CANCELLED", "CANCELED", "DELETED"])
const ASAAS_FAILED = new Set(["REFUSED", "FAILED"])

/** Status desconhecido do Asaas vira REVIEW: nunca é tratado como pago nem como terminal por suposição. */
export function chargeStatusFromAsaas(status: string | null | undefined): ChargeStatus {
  if (!status) return "REVIEW"
  if (isPaidPaymentStatus(status)) return "CONFIRMED"
  if (status === "OVERDUE") return "EXPIRED"
  if (ASAAS_PENDING.has(status)) return "PENDING"
  if (ASAAS_REFUNDED.has(status)) return "REFUNDED"
  if (ASAAS_REVIEW.has(status)) return "REVIEW"
  if (ASAAS_CANCELED.has(status)) return "CANCELED"
  if (ASAAS_FAILED.has(status)) return "FAILED"
  return "REVIEW"
}
