import { describe, expect, it } from "bun:test"
import {
  applyProviderEventTransition,
  createProviderEventDedupeKey,
  hashProviderEventPayload,
} from "./event-processing"

describe("payment provider event processing", () => {
  it("creates a scoped dedupe key that separates environments and accounts", () => {
    expect(
      createProviderEventDedupeKey({
        provider: "ABACATE_PAY",
        environment: "DEV",
        externalAccountContext: "account_a",
        eventId: "evt_1",
      }),
    ).toBe("ABACATE_PAY:DEV:account_a:evt_1")

    expect(
      createProviderEventDedupeKey({
        provider: "ABACATE_PAY",
        environment: "PRODUCTION",
        externalAccountContext: "account_a",
        eventId: "evt_1",
      }),
    ).not.toBe("ABACATE_PAY:DEV:account_a:evt_1")
  })

  it("hashes the exact raw payload for collision detection", () => {
    expect(hashProviderEventPayload('{"id":"evt_1"}')).toBe(
      "40993c639ffb5f13a0a2ef5c93c965f10b405f2b87a379272381da2dbc158dfa",
    )
  })

  it("applies confirmed, disputed and refunded transitions monotonically", () => {
    expect(applyProviderEventTransition({ currentStatus: "PENDING", event: "PAYMENT_CONFIRMED" })).toEqual({
      action: "apply",
      nextStatus: "CONFIRMED",
    })
    expect(applyProviderEventTransition({ currentStatus: "CONFIRMED", event: "PAYMENT_DISPUTED" })).toEqual({
      action: "apply",
      nextStatus: "DISPUTED",
    })
    expect(applyProviderEventTransition({ currentStatus: "DISPUTED", event: "PAYMENT_REFUNDED" })).toEqual({
      action: "apply",
      nextStatus: "REFUNDED",
    })
  })

  it("ignores late events that would regress a terminal payment", () => {
    expect(
      applyProviderEventTransition({ currentStatus: "REFUNDED", event: "PAYMENT_CONFIRMED" }),
    ).toEqual({ action: "ignore", nextStatus: "REFUNDED" })
    expect(
      applyProviderEventTransition({ currentStatus: "CONFIRMED", event: "PAYMENT_CONFIRMED" }),
    ).toEqual({ action: "ignore", nextStatus: "CONFIRMED" })
  })
})
