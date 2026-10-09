import { describe, expect, it } from "bun:test"
import { AccountAccessDecisionService } from "./AccountAccessDecisionService"

describe("AccountAccessDecisionService", () => {
  it.each([
    ["active", false],
    ["trial", false],
    [null, true],
  ])("libera apenas status permitido ou assinatura permanente (%s)", (subscriptionStatus, hasPermanentSubscription) => {
    const decision = new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus,
      hasPermanentSubscription,
      isBanned: false,
    })

    expect(decision).toEqual({ state: "allowed" })
  })

  it.each(["past_due", "suspended", "canceled", null])(
    "restringe imediatamente o status %s",
    (subscriptionStatus) => {
      const decision = new AccountAccessDecisionService().decide({
        billingOwnerId: "owner-1",
        subscriptionStatus,
        hasPermanentSubscription: false,
        isBanned: false,
      })

      expect(decision.state).toBe("restricted")
    }
  )

  it("bloqueia imediatamente uma conta past_due", () => {
    const decision = new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "past_due",
      hasPermanentSubscription: false,
      isBanned: false,
    })

    expect(decision).toEqual({ state: "restricted", reason: "past_due" })
  })

  it("bloqueia status de assinatura desconhecido", () => {
    const decision = new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "unexpected",
      hasPermanentSubscription: false,
      isBanned: false,
    })

    expect(decision).toEqual({ state: "restricted", reason: "subscription_unavailable" })
  })
})
