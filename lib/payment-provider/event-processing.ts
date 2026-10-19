import { createHash } from "node:crypto"
import type {
  PaymentAttemptStatus,
  PaymentProviderEnvironment,
  PaymentProviderKey,
  ProviderWebhookEvent,
} from "./types"

export type ProviderEventDedupeInput = {
  readonly provider: PaymentProviderKey
  readonly environment: PaymentProviderEnvironment
  readonly externalAccountContext: string
  readonly eventId: string
}

export type ProviderEventTransition =
  | { readonly action: "apply"; readonly nextStatus: PaymentAttemptStatus }
  | { readonly action: "ignore"; readonly nextStatus: PaymentAttemptStatus }
  | { readonly action: "reconcile"; readonly nextStatus: "UNKNOWN" }

export function createProviderEventDedupeKey(input: ProviderEventDedupeInput): string {
  return [input.provider, input.environment, input.externalAccountContext, input.eventId].join(":")
}

export function hashProviderEventPayload(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex")
}

export function applyProviderEventTransition(input: {
  readonly currentStatus: PaymentAttemptStatus
  readonly event: ProviderWebhookEvent["event"]
  /**
   * When true, the event was correlated to a specific attempt through an
   * attempt-unique reference (e.g. metadata.attemptId in a signed webhook).
   * This relaxes the UNKNOWN gate so a verified indeterminate payment can
   * transition to its final status instead of stalling at reconcile.
   */
  readonly correlated?: boolean
}): ProviderEventTransition {
  // A verified correlation means we know exactly which attempt this event
  // belongs to, even if that attempt never learned its provider charge id.
  // Treat UNKNOWN as CREATED (no provider state yet) so the transition
  // proceeds normally via canAdvance.
  const baseStatus = input.correlated && input.currentStatus === "UNKNOWN"
    ? "CREATED"
    : input.currentStatus

  if (baseStatus === "UNKNOWN") {
    return { action: "reconcile", nextStatus: "UNKNOWN" }
  }

  const nextStatus = eventStatus(input.event)
  if (baseStatus === nextStatus || !canAdvance(baseStatus, nextStatus)) {
    return { action: "ignore", nextStatus: baseStatus }
  }

  return { action: "apply", nextStatus }
}

function eventStatus(event: ProviderWebhookEvent["event"]): PaymentAttemptStatus {
  switch (event) {
    case "PAYMENT_CONFIRMED":
      return "CONFIRMED"
    case "PAYMENT_DISPUTED":
      return "DISPUTED"
    case "PAYMENT_REFUNDED":
      return "REFUNDED"
  }
}

function canAdvance(currentStatus: PaymentAttemptStatus, nextStatus: PaymentAttemptStatus): boolean {
  if (nextStatus === "CONFIRMED") return currentStatus === "CREATED" || currentStatus === "PENDING"
  if (nextStatus === "DISPUTED") {
    return currentStatus === "CREATED" || currentStatus === "PENDING" || currentStatus === "CONFIRMED"
  }
  if (nextStatus === "REFUNDED") {
    return (
      currentStatus === "CREATED" ||
      currentStatus === "PENDING" ||
      currentStatus === "CONFIRMED" ||
      currentStatus === "DISPUTED"
    )
  }
  return false
}
