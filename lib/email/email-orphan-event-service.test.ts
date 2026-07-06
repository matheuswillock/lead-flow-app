import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { IResendEmailEnrichmentService } from "@/app/api/services/resend/ResendEmailEnrichmentService"

const upsertMock = mock(async () => ({}))
const findManyMock = mock(async () => [] as Array<Record<string, unknown>>)
const updateMock = mock(async () => ({}))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailOrphanEvent: {
      upsert: upsertMock,
      findMany: findManyMock,
      update: updateMock,
    },
  },
}))

const { EmailOrphanEventService } = await import(
  "@/app/api/services/resend/EmailOrphanEventService"
)

describe("EmailOrphanEventService.queueOrphanEvent", () => {
  beforeEach(() => {
    upsertMock.mockClear()
  })

  it("enfileira evento sem team_id nas tags (enrichment posterior)", async () => {
    const enrichment: IResendEmailEnrichmentService = {
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    }
    const service = new EmailOrphanEventService(enrichment)

    await service.queueOrphanEvent({
      resendEmailId: "re_123",
      resendEventType: "email.delivered",
      occurredAt: new Date(),
      tagsHint: null,
    })

    expect(upsertMock).toHaveBeenCalledTimes(1)
  })

  it("ignora eventos backoffice", async () => {
    const enrichment: IResendEmailEnrichmentService = {
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    }
    const service = new EmailOrphanEventService(enrichment)

    await service.queueOrphanEvent({
      resendEmailId: "re_bo",
      resendEventType: "email.delivered",
      occurredAt: new Date(),
      tagsHint: [{ name: "module", value: "backoffice" }],
    })

    expect(upsertMock).not.toHaveBeenCalled()
  })
})

describe("EmailOrphanEventService.processPendingBatch", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    updateMock.mockClear()
  })

  it("processa órfão quando enrichment resolve logId", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-1",
        resendEmailId: "re_ok",
        occurredAt: new Date(),
        tagsHint: null,
        attempts: 0,
      },
    ])

    const enrichment: IResendEmailEnrichmentService = {
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => "log-1",
    }
    const service = new EmailOrphanEventService(enrichment)

    const result = await service.processPendingBatch()

    expect(result.processed).toBe(1)
    expect(updateMock).toHaveBeenCalled()
  })

  it("marca como skipped após esgotar tentativas sem team_id", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-2",
        resendEmailId: "re_skip",
        occurredAt: new Date(),
        tagsHint: null,
        attempts: 4,
      },
    ])

    const enrichment: IResendEmailEnrichmentService = {
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    }
    const service = new EmailOrphanEventService(enrichment)

    const result = await service.processPendingBatch()

    expect(result.skipped).toBe(1)
    const updateCall = updateMock.mock.calls[0]?.[0] as {
      data: { status: string }
    }
    expect(updateCall.data.status).toBe("skipped")
  })
})
