import { describe, expect, it, mock, beforeEach } from "bun:test"
import { EmailCreditPlan } from "@prisma/client"

const executeRawMock = mock(async () => 1)
const findUniqueMock = mock(async () => ({
  status: "active",
  plan: EmailCreditPlan.starter,
  monthlyCredits: 1000,
  currentPeriodEnd: new Date("2026-12-31"),
  usages: [{ creditsUsed: 100, overageCount: 0, overageCharged: 0 }],
}))
const grantFindUniqueMock = mock(async (): Promise<{ id: string } | null> => null)
const transactionMock = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  const tx = {
    emailCreditPaymentGrant: {
      create: mock(async () => ({ id: "grant-1" })),
    },
    emailCreditSubscription: {
      findUnique: mock(async () => null),
      create: mock(async () => ({
        id: "sub-1",
        teamId: "team-1",
        plan: EmailCreditPlan.starter,
        monthlyCredits: 1000,
      })),
      update: mock(async () => ({})),
    },
    emailCreditUsage: {
      findFirst: mock(async () => null),
      create: mock(async () => ({})),
      update: mock(async () => ({})),
    },
  }
  return fn(tx)
})

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailCreditSubscription: {
      findUnique: findUniqueMock,
    },
    emailCreditPaymentGrant: {
      findUnique: grantFindUniqueMock,
    },
    $executeRaw: executeRawMock,
    $transaction: transactionMock,
  },
}))

const { EmailCreditService, PLAN_CREDITS } = await import("./EmailCreditService")

describe("EmailCreditService", () => {
  let service: InstanceType<typeof EmailCreditService>

  beforeEach(() => {
    service = new EmailCreditService()
    executeRawMock.mockClear()
    findUniqueMock.mockClear()
    grantFindUniqueMock.mockClear()
    transactionMock.mockClear()
    grantFindUniqueMock.mockImplementation(async () => null)
    findUniqueMock.mockImplementation(async () => ({
      status: "active",
      plan: EmailCreditPlan.starter,
      monthlyCredits: 1000,
      currentPeriodEnd: new Date("2026-12-31"),
      usages: [{ creditsUsed: 100, overageCount: 0, overageCharged: 0 }],
    }))
  })

  it("formata mensagem de créditos insuficientes em PT-BR", () => {
    const message = service.formatInsufficientCreditsMessage(378, 0)
    expect(message).toContain("378")
    expect(message).toContain("Saldo: 0")
  })

  it("reserveCredits retorna ok quando update atômico afeta linha", async () => {
    executeRawMock.mockResolvedValueOnce(1)
    const result = await service.reserveCredits("team-1", 50)
    expect(result.ok).toBe(true)
    expect(executeRawMock).toHaveBeenCalled()
  })

  it("T03 — campanha com 100 destinatários debita 100 créditos", async () => {
    executeRawMock.mockResolvedValueOnce(1)
    const result = await service.reserveCredits("team-1", 100)
    expect(result.ok).toBe(true)
    expect(executeRawMock).toHaveBeenCalledTimes(1)
  })

  it("T04 — sem créditos suficientes bloqueia", async () => {
    findUniqueMock.mockImplementation(async () => ({
      status: "active",
      plan: EmailCreditPlan.starter,
      monthlyCredits: 1000,
      currentPeriodEnd: new Date("2026-12-31"),
      usages: [{ creditsUsed: 950, overageCount: 0, overageCharged: 0 }],
    }))
    const result = await service.reserveCredits("team-1", 100)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_balance")
      expect(result.available).toBe(50)
    }
    expect(executeRawMock).not.toHaveBeenCalled()
  })

  it("reserveCredits falha quando update atômico não afeta linha", async () => {
    executeRawMock.mockResolvedValueOnce(0)
    const result = await service.reserveCredits("team-1", 50)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe("insufficient_balance")
    }
  })

  it("releaseCredits é idempotente para amount <= 0", async () => {
    await service.releaseCredits("team-1", 0)
    expect(executeRawMock).not.toHaveBeenCalled()
  })

  it("T02 — applyPaidPlan cria assinatura e grant", async () => {
    const result = await service.applyPaidPlan({
      teamId: "team-1",
      plan: EmailCreditPlan.starter,
      paymentId: "pay_new",
      checkoutId: "checkout-1",
    })
    expect(result.applied).toBe(true)
    expect(result.alreadyApplied).toBe(false)
    expect(transactionMock).toHaveBeenCalledTimes(1)
  })

  it("T02 — applyPaidPlan é idempotente por paymentId", async () => {
    grantFindUniqueMock.mockImplementation(async () => ({ id: "grant-existing" }))
    const result = await service.applyPaidPlan({
      teamId: "team-1",
      plan: EmailCreditPlan.starter,
      paymentId: "pay_existing",
    })
    expect(result.applied).toBe(false)
    expect(result.alreadyApplied).toBe(true)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("precificação canônica: Upgrade 25k e Business 50k", () => {
    expect(PLAN_CREDITS.upgrade).toBe(25_000)
    expect(PLAN_CREDITS.business).toBe(50_000)
    expect(PLAN_CREDITS.starter).toBe(1_000)
  })
})
