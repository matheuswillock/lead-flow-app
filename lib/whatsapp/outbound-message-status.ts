export type OutboundMessageStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "PLAYED" | "UNKNOWN" | "FAILED"

const rank: Record<OutboundMessageStatus, number> = {
  PENDING: 0,
  SENT: 1,
  UNKNOWN: 1,
  DELIVERED: 2,
  READ: 3,
  PLAYED: 4,
  FAILED: 4,
}

/** A later webhook must not erase delivery proof already shown to the user. */
export function shouldApplyOutboundMessageStatus(current: string, next: string): boolean {
  if (current === "FAILED" || current === "PLAYED") return false
  // Delivery/read receipts are proof that the provider accepted the message;
  // a delayed failure event must never replace that proof in the UI.
  if (next === "FAILED") return !["DELIVERED", "READ", "PLAYED"].includes(current)
  if (current === "UNKNOWN") return next === "DELIVERED" || next === "READ" || next === "PLAYED"
  return (rank[next as OutboundMessageStatus] ?? 0) >= (rank[current as OutboundMessageStatus] ?? 0)
}
