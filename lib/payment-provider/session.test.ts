import { describe, expect, it } from "bun:test"
import {
  assertAttemptStatusTransition,
  PaymentProviderLeaseError,
  acquireProviderLease,
  assertProviderLease,
  type ProviderLeaseState,
} from "./session"

const currentLease: ProviderLeaseState = {
  leaseToken: "11111111-1111-4111-8111-111111111111",
  leaseUntil: new Date("2026-10-18T11:59:00.000Z"),
  fenceVersion: 4,
}

describe("payment provider durable lease", () => {
  it("increments fencing and issues a new lease token", () => {
    const next = acquireProviderLease({
      current: currentLease,
      now: new Date("2026-10-18T12:00:00.000Z"),
      ttlMs: 30_000,
      requestedBy: "worker-b",
    })

    expect(next.fenceVersion).toBe(5)
    expect(next.leaseToken).not.toBe(currentLease.leaseToken)
    expect(next.leaseUntil).toEqual(new Date("2026-10-18T12:00:30.000Z"))
  })

  it("does not steal a live lease", () => {
    expect(() =>
      acquireProviderLease({
        current: { ...currentLease, leaseUntil: new Date("2026-10-18T12:05:00.000Z") },
        now: new Date("2026-10-18T12:01:00.000Z"),
        ttlMs: 30_000,
        requestedBy: "worker-b",
      }),
    ).toThrowError(
      new PaymentProviderLeaseError("LEASE_HELD", "A lease ativa pertence a outro worker"),
    )
  })

  it("rejects stale tokens, stale fences, and expired leases", () => {
    expect(() =>
      assertProviderLease({
        expected: currentLease,
        presented: { ...currentLease, fenceVersion: 3 },
        now: new Date("2026-10-18T12:01:00.000Z"),
      }),
    ).toThrow("fence")

    expect(() =>
      assertProviderLease({
        expected: currentLease,
        presented: { ...currentLease, leaseToken: "22222222-2222-4222-8222-222222222222" },
        now: new Date("2026-10-18T12:01:00.000Z"),
      }),
    ).toThrow("token")

    expect(() =>
      assertProviderLease({
        expected: currentLease,
        presented: currentLease,
        now: new Date("2026-10-18T12:05:00.000Z"),
      }),
    ).toThrow("expirada")
  })

  it("accepts direct provider outcomes for a newly created attempt", () => {
    expect(() => assertAttemptStatusTransition("CREATED", "CONFIRMED")).not.toThrow()
    expect(() => assertAttemptStatusTransition("CREATED", "DISPUTED")).not.toThrow()
    expect(() => assertAttemptStatusTransition("CREATED", "REFUNDED")).not.toThrow()
  })
})
