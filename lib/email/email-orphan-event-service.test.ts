import { describe, expect, it, mock, beforeEach } from "bun:test"
import type { IResendEmailEnrichmentService } from "@/app/api/services/resend/ResendEmailEnrichmentService"

const upsertMock = mock(async (_args: unknown) => ({}))
const findManyMock = mock(async (_args: unknown) => [] as Array<Record<string, unknown>>)
const updateMock = mock(async () => ({}))
const updateManyMock = mock(async (_args: unknown) => ({ count: 1 }))
const findByResendEmailIdMock = mock(async () => null as null | Record<string, unknown>)
const processEmailLogWebhookMock = mock(async () => true)
const mapEventTypeMock = mock((type: string) => {
  const map: Record<string, string> = {
    "email.opened": "opened",
    "email.clicked": "clicked",
    "email.bounced": "bounced",
    "email.delivered": "delivered",
    "email.complained": "complained",
    "email.failed": "failed",
  }
  return map[type] ?? null
})
const handleEmailWebhookEventMock = mock(async () => {})
const queuePruneForSuppressedEmailMock = mock((_email: string) => {})
const queuePruneForComplaintMock = mock((_email: string) => {})
const publishResendWebhookRadarEventMock = mock(async () => ({ messageId: "mid-1" }))

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailOrphanEvent: {
      upsert: upsertMock,
      findMany: findManyMock,
      update: updateMock,
      updateMany: updateManyMock,
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

mock.module("@/app/api/useCases/email/EmailCampaignAudiencePruneUseCase", () => ({
  emailCampaignAudiencePruneUseCase: {
    queuePruneForSuppressedEmail: queuePruneForSuppressedEmailMock,
    queuePruneForComplaint: queuePruneForComplaintMock,
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

  it("T-Q4.1 — N eventos do mesmo e-mail viram N linhas (chave é a tripla)", async () => {
    const service = new EmailOrphanEventService({
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    })
    const resendEmailId = "re_multi"

    await service.queueOrphanEvent({
      resendEmailId,
      resendEventType: "email.sent",
      occurredAt: new Date("2026-08-24T10:00:00.000Z"),
    })
    await service.queueOrphanEvent({
      resendEmailId,
      resendEventType: "email.delivered",
      occurredAt: new Date("2026-08-24T10:00:05.000Z"),
    })
    await service.queueOrphanEvent({
      resendEmailId,
      resendEventType: "email.opened",
      occurredAt: new Date("2026-08-24T10:01:00.000Z"),
    })

    expect(upsertMock).toHaveBeenCalledTimes(3)
    const chaves = upsertMock.mock.calls.map(
      (call) => (call[0] as { where: Record<string, unknown> }).where,
    )
    expect(chaves).toEqual([
      {
        resendEmailId_resendEventType_occurredAt: {
          resendEmailId,
          resendEventType: "email.sent",
          occurredAt: new Date("2026-08-24T10:00:00.000Z"),
        },
      },
      {
        resendEmailId_resendEventType_occurredAt: {
          resendEmailId,
          resendEventType: "email.delivered",
          occurredAt: new Date("2026-08-24T10:00:05.000Z"),
        },
      },
      {
        resendEmailId_resendEventType_occurredAt: {
          resendEmailId,
          resendEventType: "email.opened",
          occurredAt: new Date("2026-08-24T10:01:00.000Z"),
        },
      },
    ])
    // Três chaves distintas ⇒ a unique composta cria três linhas. A chave
    // antiga (só resendEmailId) colapsaria as três no `update: {}`.
    expect(new Set(chaves.map((chave) => JSON.stringify(chave))).size).toBe(3)
  })

  it("T-Q4.2 — email.complained e email.unsubscribed órfãos são enfileirados", async () => {
    const service = new EmailOrphanEventService({
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    })

    await service.queueOrphanEvent({
      resendEmailId: "re_conformidade",
      resendEventType: "email.complained",
      occurredAt: new Date("2026-08-24T12:00:00.000Z"),
    })
    await service.queueOrphanEvent({
      resendEmailId: "re_conformidade",
      resendEventType: "email.unsubscribed",
      occurredAt: new Date("2026-08-24T12:00:01.000Z"),
    })

    const tipos = upsertMock.mock.calls.map(
      (call) => (call[0] as { create: { resendEventType: string } }).create.resendEventType,
    )
    expect(tipos).toEqual(["email.complained", "email.unsubscribed"])
  })
})

describe("EmailOrphanEventService.processPendingBatch", () => {
  beforeEach(() => {
    findManyMock.mockClear()
    updateMock.mockClear()
    updateManyMock.mockClear()
    updateManyMock.mockImplementation(async () => ({ count: 1 }))
    findByResendEmailIdMock.mockReset()
    findByResendEmailIdMock.mockResolvedValue(null)
    processEmailLogWebhookMock.mockClear()
    handleEmailWebhookEventMock.mockClear()
    publishResendWebhookRadarEventMock.mockClear()
    publishResendWebhookRadarEventMock.mockResolvedValue({ messageId: "mid-1" })
    queuePruneForSuppressedEmailMock.mockClear()
    queuePruneForComplaintMock.mockClear()
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

  it("T-Q4.3 — o dreno pede o lote recebido, ordenado por occurredAt", async () => {
    const service = new EmailOrphanEventService({
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    })

    await service.processPendingBatch(200)

    const busca = findManyMock.mock.calls.at(0)?.[0] as unknown as {
      take: number
      orderBy: unknown
      where: { status: string }
    }
    expect(busca.take).toBe(200)
    expect(busca.where.status).toBe("pending")
    expect(busca.orderBy).toEqual([{ occurredAt: "asc" }, { createdAt: "asc" }])
  })

  it("libera claims presos em processing antes de montar o lote", async () => {
    const service = new EmailOrphanEventService({
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => null,
    })

    await service.processPendingBatch(200)

    const recuperacao = updateManyMock.mock.calls.at(0)?.[0] as unknown as {
      where: { status: string }
      data: { status: string }
    }
    expect(recuperacao.where.status).toBe("processing")
    expect(recuperacao.data.status).toBe("pending")
  })

  /**
   * Review PR #1041 C1. O lease de 10 min de `recoverStaleProcessingClaims` é
   * lido de `updatedAt`. Medido no Postgres local: o Prisma 6.19.3 já preenche
   * `@updatedAt` sozinho em `updateMany`. O carimbo explícito trava a regra
   * mesmo assim — ela é de negócio e não pode depender do gerador.
   */
  it("C1 — o claim carimba updatedAt para iniciar o lease de 10 min", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-lease",
        resendEmailId: "re_lease",
        resendEventType: "email.delivered",
        occurredAt: new Date(),
        tagsHint: null,
        attempts: 0,
      },
    ])

    const service = new EmailOrphanEventService({
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => "log-lease",
    })

    await service.processPendingBatch()

    // call 0 = recuperação de stale; call 1 = claim da linha.
    const claim = updateManyMock.mock.calls.at(1)?.[0] as unknown as {
      where: { id: string; status: string }
      data: { status: string; updatedAt?: Date }
    }
    expect(claim.where).toEqual({ id: "orphan-lease", status: "pending" })
    expect(claim.data.status).toBe("processing")
    expect(claim.data.updatedAt).toBeInstanceOf(Date)
  })

  /**
   * Review PR #1041 C2. Quando um `email.complained` é o PRIMEIRO e único
   * webhook de um e-mail desconhecido, o dreno criava o EmailLog (status
   * `sent`) e marcava o órfão processado sem aplicar o evento — a reclamação
   * sumia. É justamente a conformidade que o estágio existe para garantir.
   */
  it("C2 — evento recém-admitido é aplicado ao log que o enrichment acabou de criar", async () => {
    const occurredAt = new Date("2026-08-24T15:00:00.000Z")
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-complained",
        resendEmailId: "re_complained",
        resendEventType: "email.complained",
        occurredAt,
        tagsHint: null,
        attempts: 0,
      },
    ])

    // 1ª busca: log ainda não existe (por isso vira órfão).
    // 2ª busca: depois do enrichment, o log recém-criado.
    findByResendEmailIdMock.mockResolvedValueOnce(null)
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-novo",
      teamId: "team-9",
      status: "sent",
      recipientEmail: "reclamante@test.com",
      recipientName: "Reclamante",
      campaignId: null,
    })

    const service = new EmailOrphanEventService(
      {
        fetchEmailMetadata: async () => null,
        createOrphanTeamEmailLogFromResendEmail: async () => "log-novo",
      },
      publishResendWebhookRadarEventMock
    )

    const result = await service.processPendingBatch()

    expect(result.processed).toBe(1)
    expect(processEmailLogWebhookMock).toHaveBeenCalledTimes(1)
    expect(processEmailLogWebhookMock).toHaveBeenCalledWith(
      expect.objectContaining({
        log: expect.objectContaining({ id: "log-novo" }),
        eventType: "complained",
        resendEventType: "email.complained",
        occurredAt,
      })
    )
    expect(publishResendWebhookRadarEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ logId: "log-novo", eventType: "complained" })
    )
  })

  /**
   * Review PR #1057. O caminho órfão aplicava o evento e disparava o Radar, mas
   * não a poda de audiência que o `ResendWebhookUseCase` dispara para
   * `bounced`/`complained`. Resultado: quem reclamou antes do EmailLog existir
   * continuava nas audiências já materializadas e voltava a receber envio.
   */
  it("reclamação recuperada também poda as audiências de campanha", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-prune",
        resendEmailId: "re_prune",
        resendEventType: "email.complained",
        occurredAt: new Date("2026-08-24T16:00:00.000Z"),
        tagsHint: null,
        attempts: 0,
      },
    ])
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-existente",
      teamId: "team-1",
      status: "sent",
      recipientEmail: "reclamante@test.com",
      recipientName: "Reclamante",
      campaignId: "camp-1",
    })

    const service = new EmailOrphanEventService(
      {
        fetchEmailMetadata: async () => null,
        createOrphanTeamEmailLogFromResendEmail: async () => null,
      },
      publishResendWebhookRadarEventMock
    )

    await service.processPendingBatch()

    expect(queuePruneForComplaintMock).toHaveBeenCalledWith("reclamante@test.com")
    expect(queuePruneForSuppressedEmailMock).not.toHaveBeenCalled()
  })

  it("bounce recuperado poda por supressão, não por reclamação", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-bounce",
        resendEmailId: "re_bounce",
        resendEventType: "email.bounced",
        occurredAt: new Date("2026-08-24T16:05:00.000Z"),
        tagsHint: null,
        attempts: 0,
      },
    ])
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-bounce",
      teamId: "team-1",
      status: "sent",
      recipientEmail: "invalido@test.com",
      recipientName: null,
      campaignId: null,
    })

    const service = new EmailOrphanEventService(
      {
        fetchEmailMetadata: async () => null,
        createOrphanTeamEmailLogFromResendEmail: async () => null,
      },
      publishResendWebhookRadarEventMock
    )

    await service.processPendingBatch()

    expect(queuePruneForSuppressedEmailMock).toHaveBeenCalledWith("invalido@test.com")
    expect(queuePruneForComplaintMock).not.toHaveBeenCalled()
  })

  it("evento sem impacto em audiência não dispara poda", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-opened",
        resendEmailId: "re_opened",
        resendEventType: "email.opened",
        occurredAt: new Date("2026-08-24T16:10:00.000Z"),
        tagsHint: null,
        attempts: 0,
      },
    ])
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-opened",
      teamId: "team-1",
      status: "delivered",
      recipientEmail: "leitor@test.com",
      recipientName: null,
      campaignId: null,
    })

    const service = new EmailOrphanEventService(
      {
        fetchEmailMetadata: async () => null,
        createOrphanTeamEmailLogFromResendEmail: async () => null,
      },
      publishResendWebhookRadarEventMock
    )

    await service.processPendingBatch()

    expect(queuePruneForComplaintMock).not.toHaveBeenCalled()
    expect(queuePruneForSuppressedEmailMock).not.toHaveBeenCalled()
  })

  /**
   * Review PR #1041 C3. O lote inteiro é reivindicado de uma vez; uma linha que
   * estourava abortava o `for` e deixava todas as seguintes presas em
   * `processing` até a recuperação de 10 min. Com lote de 200, uma falha
   * transitória travava quase o lote todo.
   */
  it("C3 — uma linha que estoura não impede o processamento das seguintes", async () => {
    const linha = (id: string, resendEmailId: string) => ({
      id,
      resendEmailId,
      resendEventType: "email.delivered",
      occurredAt: new Date(),
      tagsHint: null,
      attempts: 0,
    })
    findManyMock.mockResolvedValueOnce([
      linha("orphan-a", "re_a"),
      linha("orphan-b", "re_b"),
      linha("orphan-c", "re_c"),
    ])
    findByResendEmailIdMock.mockResolvedValue({
      id: "log-x",
      teamId: "team-1",
      status: "delivered",
      recipientEmail: "lead@test.com",
      recipientName: "Lead",
      campaignId: null,
    })
    processEmailLogWebhookMock.mockImplementationOnce(async () => {
      throw new Error("timeout no processEmailLogWebhook")
    })

    const service = new EmailOrphanEventService(
      {
        fetchEmailMetadata: async () => null,
        createOrphanTeamEmailLogFromResendEmail: async () => null,
      },
      publishResendWebhookRadarEventMock
    )

    const result = await service.processPendingBatch()

    // A 1ª falhou; B e C continuaram — antes da correção, o `for` abortava na A.
    expect(processEmailLogWebhookMock).toHaveBeenCalledTimes(3)
    expect(result.processed).toBe(2)
    expect(result.failed).toBe(1)

    // A linha que falhou volta para `pending`, não fica presa em `processing`.
    const liberacao = (
      updateMock.mock.calls as unknown as Array<
        [{ where: { id: string }; data: { status: string } }]
      >
    ).find((call) => call[0].where.id === "orphan-a")
    expect(liberacao?.[0].data.status).toBe("pending")
  })

  it("C3 — se a liberação individual falha, o lote devolve o claim em massa", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-preso",
        resendEmailId: "re_preso",
        resendEventType: "email.delivered",
        occurredAt: new Date(),
        tagsHint: null,
        attempts: 0,
      },
    ])
    findByResendEmailIdMock.mockResolvedValue({
      id: "log-x",
      teamId: "team-1",
      status: "delivered",
      recipientEmail: "lead@test.com",
      recipientName: "Lead",
      campaignId: null,
    })
    processEmailLogWebhookMock.mockImplementationOnce(async () => {
      throw new Error("timeout")
    })
    // A liberação individual (update) também falha.
    updateMock.mockImplementationOnce(async () => {
      throw new Error("db down")
    })

    const service = new EmailOrphanEventService(
      {
        fetchEmailMetadata: async () => null,
        createOrphanTeamEmailLogFromResendEmail: async () => null,
      },
      publishResendWebhookRadarEventMock
    )

    await service.processPendingBatch()

    const devolucaoEmMassa = (
      updateManyMock.mock.calls as unknown as Array<
        [{ where: { id?: { in?: string[] }; status?: string }; data: { status: string } }]
      >
    ).find((call) => Array.isArray(call[0].where.id?.in))
    expect(devolucaoEmMassa?.[0].where.id?.in).toEqual(["orphan-preso"])
    expect(devolucaoEmMassa?.[0].where.status).toBe("processing")
    expect(devolucaoEmMassa?.[0].data.status).toBe("pending")
  })

  it("não processa o que outra execução já reivindicou", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "orphan-disputado",
        resendEmailId: "re_race",
        occurredAt: new Date(),
        tagsHint: null,
        attempts: 0,
        resendEventType: "email.delivered",
      },
    ])
    // Recuperação de stale passa; o claim da linha perde a corrida.
    updateManyMock.mockImplementationOnce(async () => ({ count: 0 }))
    updateManyMock.mockImplementationOnce(async () => ({ count: 0 }))

    const service = new EmailOrphanEventService({
      fetchEmailMetadata: async () => null,
      createOrphanTeamEmailLogFromResendEmail: async () => "log-1",
    })

    const result = await service.processPendingBatch()

    expect(result).toEqual({ processed: 0, failed: 0, skipped: 0 })
    expect(updateMock).not.toHaveBeenCalled()
  })
})
