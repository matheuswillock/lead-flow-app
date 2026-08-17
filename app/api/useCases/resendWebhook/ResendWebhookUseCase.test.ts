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

const { ResendWebhookUseCase } = await import("@/app/api/useCases/resendWebhook/ResendWebhookUseCase")

function createWebhookService(): ResendWebhookService {
  return {
    mapEventType: (type: string) => {
      if (type === "email.delivered") return "delivered"
      if (type === "email.bounced") return "bounced"
      return null
    },
    processEmailLogWebhook: processEmailLogWebhookMock,
  } as unknown as ResendWebhookService
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
})
