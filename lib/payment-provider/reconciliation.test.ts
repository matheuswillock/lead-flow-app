import { describe, expect, it } from "bun:test"
import {
  assertPaymentCanBeChargedAgain,
  createPendingReconciliation,
  resolveReconciliation,
} from "./reconciliation"

describe("payment provider reconciliation", () => {
  it("keeps a post-send timeout indeterminate and blocks a blind retry", () => {
    const pending = createPendingReconciliation({
      provider: "ABACATE_PAY",
      environment: "DEV",
      externalAccountContext: "account_a",
      paymentAttemptId: "attempt_1",
      externalReference: "attempt_1",
      reason: "REMOTE_TIMEOUT",
    })

    expect(pending.status).toBe("PENDING")
    expect(() => assertPaymentCanBeChargedAgain(pending)).toThrow("reconciliação")
  })

  it("allows a new charge only after an audited resolution", () => {
    const pending = createPendingReconciliation({
      provider: "ABACATE_PAY",
      environment: "DEV",
      externalAccountContext: "account_a",
      paymentAttemptId: "attempt_1",
      externalReference: "attempt_1",
      reason: "REMOTE_ERROR",
    })
    const resolved = resolveReconciliation(pending, {
      resolution: "CONFIRMED_ABSENT",
      actorId: "operator_1",
      auditReference: "audit_1",
    })

    expect(resolved.status).toBe("RESOLVED")
    expect(() => assertPaymentCanBeChargedAgain(resolved)).not.toThrow()
  })
})
