import type { ReauthorizePaymentStatus } from "./ReauthorizePaymentTypes"

export function useReauthorizePaymentStatus(status: ReauthorizePaymentStatus) {
  return { isSubmitting: status === "submitting", isTerminal: status === "success" || status === "error" }
}
