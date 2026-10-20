import { describe, expect, it } from "bun:test"
import {
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_CAPABILITIES,
  PAYMENT_METHODS,
  PAYMENT_PROVIDER_KEYS,
  PaymentAmount,
  type ProviderPaymentResult,
  createIndeterminatePaymentResult,
  mapProviderStatus,
} from "./types"

describe("payment provider domain vocabulary", () => {
  it("exposes the provider, capability, method and status values as closed sets", () => {
    expect(PAYMENT_PROVIDER_KEYS).toEqual({ ASAAS: "ASAAS", ABACATE_PAY: "ABACATE_PAY" })
    expect(PAYMENT_METHODS).toEqual({ PIX: "PIX", CARD: "CARD" })
    expect(PAYMENT_CAPABILITIES).toEqual({
      CUSTOMER: "CUSTOMER",
      CATALOG: "CATALOG",
      ONE_TIME_PAYMENT: "ONE_TIME_PAYMENT",
      HOSTED_CHECKOUT: "HOSTED_CHECKOUT",
      PIX: "PIX",
      CARD: "CARD",
      STATUS_QUERY: "STATUS_QUERY",
      FULL_REFUND: "FULL_REFUND",
      WEBHOOK: "WEBHOOK",
    })
    expect(PAYMENT_ATTEMPT_STATUSES.UNKNOWN).toBe("UNKNOWN")
  })

  it("creates a validated amount value object in cents", () => {
    expect(PaymentAmount.fromCents(1250)).toEqual({ cents: 1250, currency: "BRL" })
    expect(() => PaymentAmount.fromCents(99)).toThrow("100 centavos")
    expect(() => PaymentAmount.fromCents(100.5)).toThrow("inteiro")
    expect(() => PaymentAmount.fromCents(Number.MAX_SAFE_INTEGER + 1)).toThrow("seguro")
  })

  it("represents an indeterminate result without pretending the payment failed", () => {
    expect(createIndeterminatePaymentResult({ reason: "REMOTE_TIMEOUT" })).toEqual({
      status: "UNKNOWN",
      externalId: null,
      reason: "REMOTE_TIMEOUT",
      requiresReconciliation: true,
    })
  })

  it("keeps the domain vocabulary and amount value object immutable at runtime", () => {
    expect(Object.isFrozen(PAYMENT_PROVIDER_KEYS)).toBe(true)
    expect(Object.isFrozen(PaymentAmount.fromCents(1250))).toBe(true)
  })

  it("maps known provider states and keeps unknown states indeterminate", () => {
    expect(mapProviderStatus("PAID")).toBe("CONFIRMED")
    expect(mapProviderStatus("UNDER_DISPUTE")).toBe("DISPUTED")
    expect(mapProviderStatus("PROVIDER_STATE_ADDED_LATER")).toBe("UNKNOWN")
  })

  it("requires normalized PIX data and reconciliation metadata at the type boundary", () => {
    // @ts-expect-error PIX results cannot omit the QR data.
    const invalidPixResult: ProviderPaymentResult = {
      externalId: "pay_pix",
      method: "PIX",
      status: "PENDING",
      amountInCents: 1250,
      currency: "BRL",
    }
    expect(invalidPixResult.method).toBe("PIX")

    const unknownResult = createIndeterminatePaymentResult({ reason: "REMOTE_TIMEOUT" })
    expect(unknownResult.requiresReconciliation).toBe(true)
  })

  it("requires reconciliation whenever a query or webhook status is UNKNOWN", () => {
    // @ts-expect-error UNKNOWN query results must require reconciliation.
    const invalidQueryResult: import("./types").ProviderStatusResult = {
      externalId: "pay_1",
      method: "PIX",
      status: "UNKNOWN",
      amountInCents: null,
      currency: "BRL",
    }
    // @ts-expect-error UNKNOWN webhook events must require reconciliation.
    const invalidWebhookEvent: import("./types").ProviderWebhookEvent = {
      eventId: "evt_1",
      event: "PAYMENT_CONFIRMED",
      environment: "DEV",
      externalPaymentId: "pay_1",
      method: "PIX",
      status: "UNKNOWN",
      amountInCents: null,
      occurredAt: null,
      disputeEpoch: null,
    }
    expect(invalidQueryResult.status).toBe("UNKNOWN")
    expect(invalidWebhookEvent.status).toBe("UNKNOWN")
  })

  it("does not allow known results without a bindable external identity", () => {
    const invalidPaymentResult: import("./types").ProviderPaymentResult = {
      // @ts-expect-error Known payment results require an external ID.
      externalId: null,
      method: "CARD",
      status: "CONFIRMED",
      amountInCents: 1250,
      currency: "BRL",
    }
    // @ts-expect-error Known webhook events require an external payment ID.
    const invalidWebhookEvent: import("./types").ProviderWebhookEvent = {
      eventId: "evt_1",
      event: "PAYMENT_CONFIRMED",
      environment: "DEV",
      externalPaymentId: null,
      method: "PIX",
      status: "CONFIRMED",
      amountInCents: 1250,
      occurredAt: "2026-10-20T12:00:00Z",
      disputeEpoch: null,
    }
    expect(invalidPaymentResult.externalId).toBeNull()
    expect(invalidWebhookEvent.externalPaymentId).toBeNull()
  })
})
