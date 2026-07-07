import { describe, expect, it, mock } from "bun:test"
import type { ResendWebhookService } from "@/app/api/services/resend/ResendWebhookService"

const findByResendEmailIdMock = mock(async () => null as Awaited<ReturnType<typeof import("@/app/api/infra/data/repositories/emailLog/EmailLogRepository").emailLogRepository.findByResendEmailId>>)
const queueOrphanEventMock = mock(async () => {})
const processEmailLogWebhookMock = mock(async () => true)
const applyResendWebhookEventMock = mock(async () => new (await import("@/lib/output")).Output(true, [], [], { handled: false }))

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

mock.module("@/app/api/services/cdp/CustomerDataPlatformService", () => ({
  customerDataPlatformService: {
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
    const useCase = new ResendWebhookUseCase(createWebhookService())
    const output = await useCase.handle({
      event: { type: "email.delivered", data: { created_at: new Date().toISOString() } },
    })

    expect(output.isValid).toBe(true)
    expect((output.result as { handled: boolean }).handled).toBe(false)
  })

  it("enfileira órfão quando log não existe em evento de backfill", async () => {
    queueOrphanEventMock.mockClear()
    const useCase = new ResendWebhookUseCase(createWebhookService())
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

    const useCase = new ResendWebhookUseCase(createWebhookService())
    const output = await useCase.handle({
      event: {
        type: "email.delivered",
        data: { email_id: "re_known", created_at: new Date().toISOString() },
      },
    })

    expect(queueOrphanEventMock).not.toHaveBeenCalled()
    expect(processEmailLogWebhookMock).toHaveBeenCalled()
    expect((output.result as { handled: boolean }).handled).toBe(true)
  })
})
