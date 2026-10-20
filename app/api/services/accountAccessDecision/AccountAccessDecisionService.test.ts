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
    }, new Date("2026-10-16T12:00:00.000Z"))).toEqual({
      state: "allowed",
      temporaryAccessGranted: true,
      temporaryAccessUntil: until.toISOString(),
    })

    expect(service.decide({
      billingOwnerId: "owner-1",
      subscriptionStatus: "past_due",
      hasPermanentSubscription: false,
      temporaryAccessGranted: true,
      temporaryAccessUntil: until,
      isBanned: false,
    }, new Date("2026-10-17T03:00:00.000Z"))).toMatchObject({
      state: "read_only",
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
    }, new Date("2099-12-31T23:59:59.000Z"))).toEqual({
      state: "allowed",
      temporaryAccessGranted: true,
      temporaryAccessUntil: null,
    })
  })

  it("mantém acesso normal durante os cinco dias após o vencimento", () => {
    const decision = new AccountAccessDecisionService().decide(
      {
        billingOwnerId: "owner-1",
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: new Date("2026-10-10T00:00:00.000Z"),
        hasPermanentSubscription: false,
        isBanned: false,
      },
      new Date("2026-10-12T00:00:00.000Z"),
    )

    expect(decision).toMatchObject({ state: "allowed", temporaryAccessGranted: true })
  })

  it("muda para somente leitura após o fim dos cinco dias", () => {
    const decision = new AccountAccessDecisionService().decide(
      {
        billingOwnerId: "owner-1",
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: new Date("2026-10-10T00:00:00.000Z"),
        hasPermanentSubscription: false,
        isBanned: false,
      },
      new Date("2026-10-16T00:00:00.000Z"),
    )

    expect(decision).toMatchObject({ state: "read_only", reason: "past_due" })
  })

  describe("endurecimento da concessão temporária", () => {
    const base = {
      billingOwnerId: "owner-1",
      subscriptionNextDueDate: null,
      hasPermanentSubscription: false,
      isBanned: false,
    }
    const now = new Date("2026-10-20T12:00:00.000Z")
    const future = new Date("2026-11-19T03:00:00.000Z")
    const past = new Date("2026-10-01T03:00:00.000Z")

    it("ignora uma data residual quando a concessão não está marcada como ativa", () => {
      const decision = new AccountAccessDecisionService().decide(
        { ...base, subscriptionStatus: "suspended", temporaryAccessGranted: false, temporaryAccessUntil: future },
        now,
      )

      expect(decision).toEqual({ state: "restricted", reason: "suspended" })
    })

    it("ignora a data residual quando temporaryAccessGranted nem foi informado", () => {
      const decision = new AccountAccessDecisionService().decide(
        { ...base, subscriptionStatus: "canceled", temporaryAccessUntil: future },
        now,
      )

      expect(decision).toEqual({ state: "restricted", reason: "canceled" })
    })

    it("mantém a concessão ativa do Backoffice liberando contas suspended", () => {
      const decision = new AccountAccessDecisionService().decide(
        { ...base, subscriptionStatus: "suspended", temporaryAccessGranted: true, temporaryAccessUntil: future },
        now,
      )

      expect(decision).toMatchObject({ state: "allowed", temporaryAccessGranted: true })
    })

    it("não degrada suspended/canceled para somente leitura quando a concessão expira", () => {
      for (const status of ["suspended", "canceled"] as const) {
        const decision = new AccountAccessDecisionService().decide(
          { ...base, subscriptionStatus: status, temporaryAccessGranted: true, temporaryAccessUntil: past },
          now,
        )

        expect(decision).toEqual({ state: "restricted", reason: status })
      }
    })

    it("mantém somente leitura para past_due com a concessão expirada", () => {
      const decision = new AccountAccessDecisionService().decide(
        { ...base, subscriptionStatus: "past_due", temporaryAccessGranted: true, temporaryAccessUntil: past },
        now,
      )

      expect(decision).toMatchObject({ state: "read_only", reason: "past_due" })
    })
  })
})
