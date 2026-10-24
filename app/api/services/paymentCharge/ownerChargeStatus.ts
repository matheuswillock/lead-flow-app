import type { ChargeStatus } from "@/lib/payments/charge-status"

const ADHESION: Record<string, ChargeStatus> = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  completed: "COMPLETED",
  review: "REVIEW",
  failed: "FAILED",
  superseded: "CANCELED",
}

const GRACE: Record<string, ChargeStatus> = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  completed: "COMPLETED",
}

const PURCHASE: Record<string, ChargeStatus> = {
  pending: "PENDING",
  awaiting_payment: "PENDING",
  paid: "COMPLETED",
  failed: "FAILED",
  canceled: "CANCELED",
}

/** Status desconhecido do dono vira REVIEW: nunca é assumido como pago nem como terminal. */
export const adhesionPaymentChargeStatus = (status: string): ChargeStatus => ADHESION[status] ?? "REVIEW"
export const gracePaymentChargeStatus = (status: string): ChargeStatus => GRACE[status] ?? "REVIEW"
export const purchaseChargeStatus = (status: string): ChargeStatus => PURCHASE[status] ?? "REVIEW"
