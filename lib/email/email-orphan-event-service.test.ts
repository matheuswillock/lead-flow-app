import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { IResendEmailEnrichmentService } from "@/app/api/services/resend/ResendEmailEnrichmentService"

const upsertMock = mock(async () => ({}))
const findManyMock = mock(async () => [] as Array<Record<string, unknown>>)
const updateMock = mock(async () => ({}))
const findByResendEmailIdMock = mock(async () => null as null | Record<string, unknown>)
const processEmailLogWebhookMock = mock(async () => true)
const mapEventTypeMock = mock((type: string) => {
  const map: Record<string, string> = {
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.delivered": "delivered",
  }
  return map[type] ?? null
})
const handleEmailWebhookEventMock = mock(async () => {})
const publishResendWebhookRadarEventMock = mock(async () => ({ messageId: "mid-1" }))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailOrphanEvent: {
      upsert: upsertMock,
      findMany: findManyMock,
      update: updateMock,
    },
  },
}))

mock.module("@/app/api/infra/data/repositories/emailLog/EmailLogRepository", () => ({
  emailLogRepository: {
    findByResendEmailId: findByResendEmailIdMock,
  },
}))

mock.module("@/app/api/services/resend/ResendWebhookService", () => {
  // Mantém a classe exportada para não poluir outros testes que importam ResendWebhookService.
  const EVENT_TYPE_MAP: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.suppressed": "suppressed",
    "email.delivery_delayed": "delivery_delayed",
    "email.unsubscribed": "unsubscribed",
    "email.failed": "failed",
  }

  class ResendWebhookService {
    constructor(
      private readonly emailLogs: {
        hasDuplicateEvent: (
          logId: string,
          eventType: string,
          occurredAt: Date
        ) => Promise<boolean>
        applyWebhookEvent: (input: Record<string, unknown>) => Promise<void>
      } = {
        hasDuplicateEvent: async () => false,
        applyWebhookEvent: async () => {},
      }
    ) {}

    mapEventType(resendEventType: string) {
      return EVENT_TYPE_MAP[resendEventType] ?? null
    }

    async processEmailLogWebhook(input: {
      log: { id: string }
      eventType: string
      occurredAt: Date
      metadata: Record<string, unknown>
      resendEventType: string
      svixId?: string | null
    }) {
      const eventMetadata = {
        ...input.metadata,
        ...(input.svixId ? { svixId: input.svixId } : {}),
      }
      const duplicate = await this.emailLogs.hasDuplicateEvent(
        input.log.id,
        input.eventType,
        input.occurredAt
      )
      if (duplicate) return true
      await this.emailLogs.applyWebhookEvent({
        log: input.log,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        metadata: eventMetadata,
        eventId: crypto.randomUUID(),
      })
      return true
    }
  }

  return {
    ResendWebhookService,
    resendWebhookService: {
      mapEventType: mapEventTypeMock,
      processEmailLogWebhook: processEmailLogWebhookMock,
    },
  }
})

mock.module("@/app/api/services/radar/RadarService", () => ({
  radarService: {
    handleEmailWebhookEvent: handleEmailWebhookEventMock,
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
    findByResendEmailIdMock.mockReset()
    findByResendEmailIdMock.mockResolvedValue(null)
    processEmailLogWebhookMock.mockClear()
    handleEmailWebhookEventMock.mockClear()
    publishResendWebhookRadarEventMock.mockClear()
    publishResendWebhookRadarEventMock.mockResolvedValue({ messageId: "mid-1" })
  })

  it("processa órfão quando enrichment resolve logId", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-1",
        resendEmailId: "re_ok",
        occurredAt: new Date(),
        tagsHint: null,
        attempts: 0,
        resendEventType: "email.delivered",
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

  it("repassa evento recuperado para webhook + Radar quando o log já existe", async () => {
    const occurredAt = new Date("2026-07-17T12:00:00.000Z")
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-recovered",
        resendEmailId: "re_race",
        resendEventType: "email.opened",
        occurredAt,
        tagsHint: null,
        attempts: 0,
      },
    ])
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-race",
      teamId: "team-1",
      status: "delivered",
      recipientEmail: "lead@test.com",
      recipientName: "Lead",
      campaignId: "camp-1",
      dispatchId: "disp-1",
      deliveredAt: occurredAt,
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      complainedAt: null,
    })

    const enrichment: IResendEmailEnrichmentService = {
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    }
    const service = new EmailOrphanEventService(enrichment, publishResendWebhookRadarEventMock)

    const result = await service.processPendingBatch()

    expect(result.processed).toBe(1)
    expect(processEmailLogWebhookMock).toHaveBeenCalledTimes(1)
    expect(publishResendWebhookRadarEventMock).toHaveBeenCalledTimes(1)
    expect(publishResendWebhookRadarEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        recipientEmail: "lead@test.com",
        logId: "log-race",
        campaignId: "camp-1",
        eventType: "opened",
        occurredAt: occurredAt.toISOString(),
        emailOrphanEventId: "orphan-recovered",
      })
    )
    expect(handleEmailWebhookEventMock).not.toHaveBeenCalled()
  })

  it("marca como skipped após esgotar tentativas sem team_id", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-2",
        resendEmailId: "re_skip",
        occurredAt: new Date(),
        tagsHint: null,
        attempts: 4,
        resendEventType: "email.delivered",
      },
    ])

    const enrichment: IResendEmailEnrichmentService = {
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    }
    const service = new EmailOrphanEventService(enrichment)

    const result = await service.processPendingBatch()

    expect(result.skipped).toBe(1)
    const updateCall = (updateMock.mock.calls as unknown as Array<[{ data: { status: string } }]>).at(0)?.[0]
    expect(updateCall?.data.status).toBe("skipped")
  })
})
