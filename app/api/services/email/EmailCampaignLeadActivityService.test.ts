import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"

const createIdempotentLeadActivity = mock(async () => ({ id: "activity-1" }))
const resolveLeadIdFromRecipientEmail = mock(async (): Promise<string | null> => "lead-1")

mock.module("@/lib/lead-activities/createIdempotentLeadActivity", () => ({
  createIdempotentLeadActivity,
}))

mock.module("@/lib/lead-activities/resolveLeadIdFromRecipientEmail", () => ({
  resolveLeadIdFromRecipientEmail,
}))

/**
 * `withPrismaRetry` real reconecta o client compartilhado (`$connect()`)
 * antes de repetir — depende de `DATABASE_URL`, indisponível neste teste
 * isolado (`bun test --isolate`) e sem relação com o que este arquivo
 * verifica (que o serviço retenta em erro transitório de pool). Reimplementa
 * aqui a mesma semântica de retry (códigos transitórios do Prisma,
 * `retries`/`delayMs`) sem o efeito colateral de reconexão real.
 */
const TRANSIENT_PRISMA_ERROR_CODES = new Set(["P1017", "P1001", "P1002", "P1008", "P2024"])

mock.module("@/app/api/infra/data/prisma", () => ({
  withPrismaRetry: async <T>(
    operation: () => Promise<T>,
    options?: { retries?: number; label?: string; delayMs?: number }
  ): Promise<T> => {
    const retries = options?.retries ?? 1
    const delayMs = options?.delayMs ?? 150
    let lastError: unknown

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        const code = (error as { code?: string } | null)?.code
        const isTransient = !!code && TRANSIENT_PRISMA_ERROR_CODES.has(code)
        const hasRetriesLeft = attempt < retries
        if (!isTransient || !hasRetriesLeft) throw error
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }

    throw lastError
  },
}))

const { EmailCampaignLeadActivityService } = await import("./EmailCampaignLeadActivityService")

describe("EmailCampaignLeadActivityService", () => {
  it("não cria atividade quando não há lead vinculado ao contato", async () => {
    resolveLeadIdFromRecipientEmail.mockResolvedValueOnce(null)
    createIdempotentLeadActivity.mockClear()

    const service = new EmailCampaignLeadActivityService()
    await service.recordDispatchForRecipient({
      teamId: "team-1",
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "sem-lead@test.com",
      subject: "Assunto",
    })

    expect(createIdempotentLeadActivity).not.toHaveBeenCalled()
  })

  it("cria atividade idempotente por dispatchId", async () => {
    resolveLeadIdFromRecipientEmail.mockResolvedValueOnce("lead-1")
    createIdempotentLeadActivity.mockClear()

    const service = new EmailCampaignLeadActivityService()
    await service.recordDispatchForRecipient({
      teamId: "team-1",
      campaignId: "campaign-1",
      dispatchId: "dispatch-1",
      recipientEmail: "lead@test.com",
      subject: "Campanha de teste",
      campaignName: "Alto Padrão · Form 1 · Dia 1",
    })

    expect(createIdempotentLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        leadId: "lead-1",
        type: "email",
        body: "E-mail enviado: Campanha de teste",
        sourceKey: "email:dispatch:dispatch-1",
        createdBy: null,
        payload: {
          campaignId: "campaign-1",
          subject: "Campanha de teste",
          dispatchId: "dispatch-1",
          campaignName: "Alto Padrão · Form 1 · Dia 1",
        },
      })
    )
  })

  it("repete e conclui com sucesso após timeout transitório de pool (P2024)", async () => {
    createIdempotentLeadActivity.mockClear()
    resolveLeadIdFromRecipientEmail.mockClear()
    let calls = 0
    resolveLeadIdFromRecipientEmail.mockImplementationOnce(async () => {
      calls++
      throw new Prisma.PrismaClientKnownRequestError("Timed out fetching a new connection", {
        code: "P2024",
        clientVersion: "test",
      })
    })
    resolveLeadIdFromRecipientEmail.mockResolvedValueOnce("lead-2")

    const service = new EmailCampaignLeadActivityService()
    await service.recordDispatchForRecipient({
      teamId: "team-1",
      campaignId: "campaign-1",
      dispatchId: "dispatch-2",
      recipientEmail: "retry@test.com",
      subject: "Assunto com retry",
    })

    expect(calls).toBe(1)
    expect(resolveLeadIdFromRecipientEmail).toHaveBeenCalledTimes(2)
    expect(createIdempotentLeadActivity).toHaveBeenCalledWith(
      expect.objectContaining({ leadId: "lead-2", sourceKey: "email:dispatch:dispatch-2" })
    )
  })

  it("propaga o erro quando o timeout de pool persiste após a tentativa de retry", async () => {
    createIdempotentLeadActivity.mockClear()
    resolveLeadIdFromRecipientEmail.mockClear()
    resolveLeadIdFromRecipientEmail.mockImplementation(async () => {
      throw new Prisma.PrismaClientKnownRequestError("Timed out fetching a new connection", {
        code: "P2024",
        clientVersion: "test",
      })
    })

    const service = new EmailCampaignLeadActivityService()
    await expect(
      service.recordDispatchForRecipient({
        teamId: "team-1",
        campaignId: "campaign-1",
        dispatchId: "dispatch-3",
        recipientEmail: "sempre-falha@test.com",
        subject: "Assunto",
      })
    ).rejects.toThrow()

    expect(createIdempotentLeadActivity).not.toHaveBeenCalled()

    resolveLeadIdFromRecipientEmail.mockImplementation(async () => "lead-1")
  })

  it("nunca excede o limite global de concorrência entre chamadas concorrentes (backpressure)", async () => {
    createIdempotentLeadActivity.mockClear()
    let inFlight = 0
    let maxInFlight = 0
    resolveLeadIdFromRecipientEmail.mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight--
      return "lead-1"
    })

    const service = new EmailCampaignLeadActivityService()
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        service.recordDispatchForRecipient({
          teamId: "team-1",
          campaignId: "campaign-1",
          dispatchId: `dispatch-backpressure-${i}`,
          recipientEmail: `contato-${i}@test.com`,
          subject: "Assunto",
        })
      )
    )

    const configuredLimit = Math.max(1, Number(process.env.EMAIL_CAMPAIGN_LEAD_ACTIVITY_MAX_CONCURRENT ?? 2))
    expect(maxInFlight).toBeLessThanOrEqual(configuredLimit)
    expect(maxInFlight).toBeGreaterThan(0)

    resolveLeadIdFromRecipientEmail.mockImplementation(async () => "lead-1")
  })
})
