import { describe, expect, it, mock } from "bun:test"
import type { ResendWebhookService } from "@/app/api/services/resend/ResendWebhookService"

const findByResendEmailIdMock = mock(async () => null as Awaited<ReturnType<typeof import("@/app/api/infra/data/repositories/emailLog/EmailLogRepository").emailLogRepository.findByResendEmailId>>)
const queueOrphanEventMock = mock(async () => {})
const processEmailLogWebhookMock = mock(async () => true)
const applyResendWebhookEventMock = mock(async () => new (await import("@/lib/output")).Output(true, [], [], { handled: false }))
const applyBackofficeCampaignWebhookEventMock = mock(async () => new (await import("@/lib/output")).Output(true, [], [], { handled: false }))

mock.module("@/app/api/infra/data/repositories/emailLog/EmailLogRepository", () => ({
  emailLogRepository: {
    findByResendEmailId: findByResendEmailIdMock,
  },
}))

mock.module("@/app/api/services/resend/EmailOrphanEventService", () => ({
  emailOrphanEventService: {
    queueOrphanEvent: queueOrphanEventMock,
  },
}))

mock.module("@/app/api/useCases/backofficeEmailDispatch/BackofficeEmailDispatchUseCase", () => ({
  backofficeEmailDispatchUseCase: {
    applyResendWebhookEvent: applyResendWebhookEventMock,
  },
}))

mock.module("@/app/api/useCases/backofficeEmailCampaign/BackofficeEmailCampaignUseCase", () => ({
  backofficeEmailCampaignUseCase: {
    applyResendWebhookEvent: applyBackofficeCampaignWebhookEventMock,
  },
}))

const publishResendWebhookRadarEventMock = mock(async () => ({ messageId: "mid-1" }))

mock.module("@/app/api/services/radar/RadarService", () => ({
  radarService: {
    handleEmailWebhookEvent: mock(async () => {}),
  },
}))

mock.module("@/app/api/useCases/resendWebhook/ResendDomainWebhookUseCase", () => ({
  resendDomainWebhookUseCase: {
    handle: mock(async () => new (await import("@/lib/output")).Output(true, [], [], { handled: true })),
  },
}))

const queuePruneForSuppressedEmailMock = mock(() => {})
const queuePruneForComplaintMock = mock(() => {})
mock.module("@/app/api/useCases/email/EmailCampaignAudiencePruneUseCase", () => ({
  emailCampaignAudiencePruneUseCase: {
    queuePruneForSuppressedEmail: queuePruneForSuppressedEmailMock,
    queuePruneForComplaint: queuePruneForComplaintMock,
    queueCampaignAudiencePrune: mock(() => {}),
  },
}))

const { ResendWebhookUseCase } = await import("@/app/api/useCases/resendWebhook/ResendWebhookUseCase")
const { ResendWebhookService: RealResendWebhookService } = await import(
  "@/app/api/services/resend/ResendWebhookService"
)

// `resolveOccurredAt` é lógica pura de payload — usa a implementação REAL para
// que os asserts de timestamp exercitem o código de produção, não um espelho.
const realServiceForTimestamps = new RealResendWebhookService({} as never)

function createWebhookService(): ResendWebhookService {
  return {
    mapEventType: (type: string) => {
      if (type === "email.delivered") return "delivered"
      if (type === "email.bounced") return "bounced"
      if (type === "email.complained") return "complained"
      if (type === "email.opened") return "opened"
      if (type === "email.clicked") return "clicked"
      return null
    },
    resolveOccurredAt: realServiceForTimestamps.resolveOccurredAt.bind(realServiceForTimestamps),
    processEmailLogWebhook: processEmailLogWebhookMock,
  } as unknown as ResendWebhookService
}

function buildWebhookLogRecord(overrides: Partial<{ deliveredAt: Date | null }> = {}) {
  return {
    id: "log-1",
    teamId: "team-1",
    status: "delivered" as const,
    recipientEmail: "a@test.com",
    recipientName: null,
    campaignId: null,
    dispatchId: null,
    deliveredAt: overrides.deliveredAt ?? null,
    openedAt: null as Date | null,
    clickedAt: null as Date | null,
    bouncedAt: null as Date | null,
    complainedAt: null as Date | null,
  }
}

type ProcessedWebhookCall = {
  occurredAt: Date
  metadata: Record<string, unknown>
  origin?: { classification: string; botSource?: string; uaFamily?: string }
}

function lastProcessedWebhookCall(): ProcessedWebhookCall {
  const call = processEmailLogWebhookMock.mock.calls[0] as unknown as [ProcessedWebhookCall]
  return call[0]
}

describe("ResendWebhookUseCase", () => {
  it("ignora evento sem email_id", async () => {
    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    const output = await useCase.handle({
      event: { type: "email.delivered", data: { created_at: new Date().toISOString() } },
    })

    expect(output.isValid).toBe(true)
    expect((output.result as { handled: boolean }).handled).toBe(false)
  })

  it("enfileira órfão quando log não existe em evento de backfill", async () => {
    queueOrphanEventMock.mockClear()
    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.delivered",
        data: {
          email_id: "re_orphan",
          created_at: new Date().toISOString(),
          tags: { team_id: "team-1" },
        },
      },
      svixId: "svix-1",
    })

    expect(queueOrphanEventMock).toHaveBeenCalled()
  })

  it("processa log existente sem enfileirar órfão", async () => {
    queueOrphanEventMock.mockClear()
    publishResendWebhookRadarEventMock.mockClear()
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-1",
      teamId: "team-1",
      status: "sent",
      recipientEmail: "a@test.com",
      recipientName: null,
      campaignId: null,
      dispatchId: null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      complainedAt: null,
    })

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    const output = await useCase.handle({
      event: {
        type: "email.delivered",
        data: { email_id: "re_known", created_at: new Date().toISOString() },
      },
    })

    expect(queueOrphanEventMock).not.toHaveBeenCalled()
    expect(processEmailLogWebhookMock).toHaveBeenCalled()
    expect(publishResendWebhookRadarEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        recipientEmail: "a@test.com",
        logId: "log-1",
        eventType: "delivered",
      })
    )
    expect((output.result as { handled: boolean }).handled).toBe(true)
  })

  it("persiste bounceSubType e bounceDiagnosticCode no metadata", async () => {
    processEmailLogWebhookMock.mockClear()
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-bounce",
      teamId: "team-1",
      status: "sent",
      recipientEmail: "ana@terra.com.br",
      recipientName: null,
      campaignId: null,
      dispatchId: null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      complainedAt: null,
    })

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.bounced",
        data: {
          email_id: "re_bounce",
          created_at: new Date().toISOString(),
          bounce: {
            message: "content that the provider doesn't allow",
            type: "Transient",
            subType: "ContentRejected",
            diagnosticCode: ["smtp; 554 5.7.1 content rejected"],
          },
        },
      },
    })

    expect(processEmailLogWebhookMock).toHaveBeenCalled()
    const input = processEmailLogWebhookMock.mock.calls[0] as unknown as [
      { metadata: Record<string, unknown> },
    ]
    expect(input[0].metadata).toEqual(
      expect.objectContaining({
        bounceMessage: "content that the provider doesn't allow",
        bounceType: "Transient",
        bounceSubType: "ContentRejected",
        bounceDiagnosticCode: ["smtp; 554 5.7.1 content rejected"],
      })
    )
  })

  it("persiste MailboxFull no metadata sem omitir o subType", async () => {
    processEmailLogWebhookMock.mockClear()
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-full",
      teamId: "team-1",
      status: "sent",
      recipientEmail: "ana@gmail.com",
      recipientName: null,
      campaignId: null,
      dispatchId: null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      complainedAt: null,
    })

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.bounced",
        data: {
          email_id: "re_full",
          created_at: new Date().toISOString(),
          bounce: {
            message: "The recipient's inbox was full.",
            type: "Transient",
            subType: "MailboxFull",
          },
        },
      },
    })

    const input = processEmailLogWebhookMock.mock.calls[0] as unknown as [
      { metadata: Record<string, unknown> },
    ]
    expect(input[0].metadata).toEqual(
      expect.objectContaining({
        bounceMessage: "The recipient's inbox was full.",
        bounceType: "Transient",
        bounceSubType: "MailboxFull",
      })
    )
  })

  it("cai para o motor de campanhas do backoffice quando produto e dispatch transacional não encontram o log", async () => {
    findByResendEmailIdMock.mockResolvedValueOnce(null)
    applyResendWebhookEventMock.mockResolvedValueOnce(
      new (await import("@/lib/output")).Output(true, [], [], { handled: false })
    )
    applyBackofficeCampaignWebhookEventMock.mockResolvedValueOnce(
      new (await import("@/lib/output")).Output(true, [], [], { handled: true })
    )

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    const output = await useCase.handle({
      event: {
        type: "email.delivered",
        data: { email_id: "re_campaign_log", created_at: new Date().toISOString() },
      },
    })

    expect(applyBackofficeCampaignWebhookEventMock).toHaveBeenCalled()
    expect(output.result).toEqual({ handled: true, target: "backoffice_email_campaign" })
  })

  it("dispara poda de audiência após bounce", async () => {
    queuePruneForSuppressedEmailMock.mockClear()
    findByResendEmailIdMock.mockResolvedValueOnce({
      id: "log-bounce",
      teamId: "team-1",
      status: "sent",
      recipientEmail: "bounce@test.com",
      recipientName: null,
      campaignId: "camp-1",
      dispatchId: null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      complainedAt: null,
    })

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.bounced",
        data: { email_id: "re_bounce", created_at: new Date().toISOString() },
      },
    })

    expect(processEmailLogWebhookMock).toHaveBeenCalled()
    expect(queuePruneForSuppressedEmailMock).toHaveBeenCalledWith("bounce@test.com")
  })

  it("email.opened usa open.timestamp como occurredAt e classifica o proxy do Gmail como bot", async () => {
    processEmailLogWebhookMock.mockClear()
    const deliveredAt = new Date("2026-09-17T16:04:00.000Z")
    findByResendEmailIdMock.mockResolvedValueOnce(buildWebhookLogRecord({ deliveredAt }))

    const emailCreatedAt = "2026-09-17T16:03:54.976Z"
    const openTimestamp = "2026-09-17T17:39:13.477Z"

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.opened",
        created_at: openTimestamp,
        data: {
          email_id: "re_opened",
          created_at: emailCreatedAt,
          open: {
            ipAddress: "74.125.208.10",
            userAgent:
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246 Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
            timestamp: openTimestamp,
          },
        },
      },
    })

    expect(processEmailLogWebhookMock).toHaveBeenCalledTimes(1)
    const call = lastProcessedWebhookCall()
    // A âncora é o momento do OPEN, não a criação do e-mail — sem isso toda
    // repetição de abertura colide no dedupe e some.
    expect(call.occurredAt.toISOString()).toBe(openTimestamp)
    expect(call.origin?.classification).toBe("bot")
    expect(call.origin?.botSource).toBe("gmail-proxy")
    expect((call.metadata.origin as { classification: string }).classification).toBe("bot")
    // LGPD: o IP cru não pode aparecer em nenhum canto do metadata persistido.
    expect(JSON.stringify(call.metadata)).not.toContain("74.125.208.10")
  })

  it("email.opened de destinatário real (fixture de produção) é classificado human", async () => {
    processEmailLogWebhookMock.mockClear()
    const deliveredAt = new Date("2026-09-17T16:04:00.000Z")
    findByResendEmailIdMock.mockResolvedValueOnce(buildWebhookLogRecord({ deliveredAt }))

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.opened",
        created_at: "2026-09-17T17:39:13.477Z",
        data: {
          email_id: "re_opened_human",
          created_at: "2026-09-17T16:03:54.976Z",
          open: {
            ipAddress: "187.104.124.17",
            userAgent: "Mozilla/4.0 (compatible; ms-office; MSOffice 16)",
            timestamp: "2026-09-17T17:39:13.477Z",
          },
        },
      },
    })

    const call = lastProcessedWebhookCall()
    expect(call.origin?.classification).toBe("human")
    expect(call.origin?.uaFamily).toBe("outlook")
    expect(JSON.stringify(call.metadata)).not.toContain("187.104.124.17")
  })

  it("email.clicked persiste link e userAgent mas nunca o ipAddress cru", async () => {
    processEmailLogWebhookMock.mockClear()
    findByResendEmailIdMock.mockResolvedValueOnce(buildWebhookLogRecord({ deliveredAt: new Date("2026-09-17T16:04:00.000Z") }))

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.clicked",
        created_at: "2026-09-17T16:04:10.000Z",
        data: {
          email_id: "re_clicked",
          created_at: "2026-09-17T16:03:54.000Z",
          click: {
            link: "https://www.corretorstudio.com/forms/abc?cs_el=log-1",
            userAgent: "Mozilla/5.0 (compatible; ProofpointEssentials)",
            ipAddress: "148.163.129.50",
            timestamp: "2026-09-17T16:04:10.000Z",
          },
        },
      },
    })

    const call = lastProcessedWebhookCall()
    expect(call.occurredAt.toISOString()).toBe("2026-09-17T16:04:10.000Z")
    expect(call.metadata.link).toBe("https://www.corretorstudio.com/forms/abc?cs_el=log-1")
    expect(call.metadata.userAgent).toContain("Proofpoint")
    expect(call.metadata.ipAddress).toBeUndefined()
    expect(JSON.stringify(call.metadata)).not.toContain("148.163.129.50")
    // Scanner clicando link é bot/scanner — não engajamento humano.
    expect(call.origin?.classification).toBe("bot")
    expect(call.origin?.botSource).toBe("scanner")
  })

  it("abertura órfã é enfileirada COM a classificação de origem (os sinais crus morrem aqui)", async () => {
    queueOrphanEventMock.mockClear()
    findByResendEmailIdMock.mockResolvedValue(null)

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.opened",
        created_at: "2026-09-17T16:04:07.000Z",
        data: {
          email_id: "re_orphan_open",
          created_at: "2026-09-17T16:03:54.000Z",
          tags: { team_id: "team-1" },
          open: {
            ipAddress: "74.125.210.9",
            userAgent: "Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)",
            timestamp: "2026-09-17T16:04:07.000Z",
          },
        },
      },
    })

    expect(queueOrphanEventMock).toHaveBeenCalled()
    const queued = queueOrphanEventMock.mock.calls[0] as unknown as [
      { originHint?: { classification: string; botSource?: string } },
    ]
    expect(queued[0].originHint?.classification).toBe("bot")
    expect(queued[0].originHint?.botSource).toBe("gmail-proxy")
    // IP nunca viaja para a fila — só o resultado da classificação.
    expect(JSON.stringify(queued[0])).not.toContain("74.125.210.9")
  })

  it("órfão de tipo sem sinal de origem (delivered) é enfileirado sem originHint", async () => {
    queueOrphanEventMock.mockClear()
    findByResendEmailIdMock.mockResolvedValue(null)

    const useCase = new ResendWebhookUseCase(createWebhookService(), publishResendWebhookRadarEventMock)
    await useCase.handle({
      event: {
        type: "email.delivered",
        data: {
          email_id: "re_orphan_delivered",
          created_at: "2026-09-17T16:03:54.000Z",
          tags: { team_id: "team-1" },
        },
      },
    })

    const queued = queueOrphanEventMock.mock.calls[0] as unknown as [{ originHint?: unknown }]
    expect(queued[0].originHint).toBeUndefined()
  })
})
