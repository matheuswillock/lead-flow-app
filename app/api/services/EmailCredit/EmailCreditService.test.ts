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

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailCreditSubscription: {
      findUnique: findUniqueMock,
    },
    $executeRaw: executeRawMock,
  },
}))

const { EmailCreditService } = await import("./EmailCreditService")

describe("EmailCreditService", () => {
  let service: InstanceType<typeof EmailCreditService>

  beforeEach(() => {
    service = new EmailCreditService()
    executeRawMock.mockClear()
    findUniqueMock.mockClear()
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

  it("reserveCredits falha quando update atômico não afeta linha", async () => {
    executeRawMock.mockResolvedValueOnce(0)
    const result = await service.reserveCredits("team-1", 50)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("insufficient_balance")
  })

  it("releaseCredits é idempotente para amount <= 0", async () => {
    await service.releaseCredits("team-1", 0)
    expect(executeRawMock).not.toHaveBeenCalled()
  })
})
