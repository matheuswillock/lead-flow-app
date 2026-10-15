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
  it("bloqueia uma assinatura ativa cuja data de vencimento já passou", () => {
    const decision = new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "active",
      subscriptionNextDueDate: new Date("2026-10-10T23:59:59.000Z"),
      hasPermanentSubscription: false,
      isBanned: false,
    }, new Date("2026-10-11T04:00:00.000Z"))

    expect(decision).toEqual({ state: "restricted", reason: "past_due" })
  })

  it.each(["past_due", "suspended", "canceled"])(
    "libera Member PRO vigente mesmo com status %s",
    (subscriptionStatus) => {
      const decision = new AccountAccessDecisionService().decide({
        billingOwnerId: "owner-1",
        subscriptionStatus,
        hasPermanentSubscription: false,
        memberProActive: true,
        isBanned: false,
      })

      expect(decision).toEqual({ state: "allowed" })
    }
  )

  it("mantém o banimento acima do Member PRO vigente", () => {
    const decision = new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "suspended",
      hasPermanentSubscription: false,
      memberProActive: true,
      isBanned: true,
    })

    expect(decision).toEqual({ state: "restricted", reason: "banned" })
  })

  it("bloqueia Member PRO expirado mesmo com assinatura local active", () => {
    const decision = new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "active",
      hasPermanentSubscription: false,
      memberProActive: false,
      memberProBlocked: true,
      isBanned: false,
    })

    expect(decision).toEqual({ state: "restricted", reason: "past_due" })
  })

  it("libera uma exceção de cobrança válida somente até sua expiração", () => {
    const service = new AccountAccessDecisionService()
    const until = new Date("2026-10-17T02:59:59.999Z")

    expect(service.decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "past_due",
      hasPermanentSubscription: false,
      temporaryAccessGranted: true,
      temporaryAccessUntil: until,
      isBanned: false,
    }, new Date("2026-10-16T12:00:00.000Z"))).toEqual({ state: "allowed" })

    expect(service.decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "past_due",
      hasPermanentSubscription: false,
      temporaryAccessGranted: true,
      temporaryAccessUntil: until,
      isBanned: false,
    }, new Date("2026-10-17T03:00:00.000Z"))).toEqual({
      state: "restricted",
      reason: "past_due",
    })
  })

  it("libera assinatura anual válida sem grace", () => {
    const decision = new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "past_due",
      subscriptionNextDueDate: new Date("2027-10-15T00:00:00.000Z"),
      hasPermanentSubscription: false,
      annualSubscriptionActive: true,
      temporaryAccessGranted: false,
      isBanned: false,
    })

    expect(decision).toEqual({ state: "allowed" })
  })

  it("mantém banimento acima da assinatura anual válida", () => {
    expect(new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "active",
      hasPermanentSubscription: false,
      annualSubscriptionActive: true,
      isBanned: true,
    })).toEqual({ state: "restricted", reason: "banned" })
  })

  it("mantém banimento acima da exceção temporária", () => {
    expect(new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "past_due",
      hasPermanentSubscription: false,
      temporaryAccessGranted: true,
      temporaryAccessUntil: new Date("2026-10-17T02:59:59.999Z"),
      isBanned: true,
    })).toEqual({ state: "restricted", reason: "banned" })
  })

  it("libera uma exceção operacional explicitamente indefinida", () => {
    expect(new AccountAccessDecisionService().decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "past_due",
      hasPermanentSubscription: false,
      temporaryAccessGranted: true,
      temporaryAccessUntil: null,
      isBanned: false,
    }, new Date("2099-12-31T23:59:59.000Z"))).toEqual({ state: "allowed" })
  })
})
