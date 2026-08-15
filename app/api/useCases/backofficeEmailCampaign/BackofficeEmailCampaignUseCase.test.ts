import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { BackofficeEmailCampaign, BackofficeEmailCampaignDispatch } from "@prisma/client"

const getTemplateMock = mock(async () => ({ subject: "Assunto", html: "<p>Corpo</p>" }))
mock.module("@/app/api/services/backofficeEmailTemplates/BackofficeEmailTemplatesService", () => ({
  backofficeEmailTemplatesService: { get: getTemplateMock },
}))

const publishWakeMock = mock(async () => ({ messageId: "msg-1" }))
mock.module("@/lib/queues/backoffice-email-campaign-dispatch", () => ({
  publishBackofficeEmailCampaignDispatchWake: publishWakeMock,
}))

const { BackofficeEmailCampaignUseCase } = await import("./BackofficeEmailCampaignUseCase")

function buildCampaign(overrides: Partial<BackofficeEmailCampaign> = {}): BackofficeEmailCampaign {
  return {
    id: "campaign-1",
    name: "Live — 20/08/2026",
    type: "live_weekly",
    status: "scheduled",
    resendTemplateId: "template-1",
    resendTemplateName: "Template",
    contactListId: "list-1",
    fromName: null,
    fromEmail: null,
    replyTo: null,
    scheduledAt: new Date("2026-08-20T16:00:00.000Z"),
    sentAt: null,
    totalRecipients: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalBounced: 0,
    totalComplained: 0,
    dispatchCount: 0,
    errorMessage: null,
    createdByBackofficeUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as BackofficeEmailCampaign
}

function buildDispatch(
  overrides: Partial<BackofficeEmailCampaignDispatch> = {}
): BackofficeEmailCampaignDispatch {
  return {
    id: "dispatch-1",
    campaignId: "campaign-1",
    dispatchNumber: 1,
    templateSubjectSnapshot: "Assunto",
    templateHtmlSnapshot: "<p>Corpo</p>",
    resendTemplateIdSnapshot: "template-1",
    status: "sending",
    totalRecipients: 2,
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    totalBounced: 0,
    totalComplained: 0,
    triggeredByBackofficeUserId: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as BackofficeEmailCampaignDispatch
}

function makeRepositories() {
  const campaignRepository = {
    findById: mock(async (_id: string): Promise<BackofficeEmailCampaign | null> => buildCampaign()),
    claimForDispatch: mock(async (_id: string) => true),
    findDueForDispatch: mock(async (_now: Date): Promise<BackofficeEmailCampaign[]> => []),
    markFailed: mock(async (id: string, errorMessage: string) => buildCampaign({ id, status: "failed", errorMessage })),
    markSent: mock(
      async (id: string, dispatchCount: number, counters: Record<string, number>) =>
        buildCampaign({ id, status: "sent", dispatchCount, ...counters })
    ),
    findStuckSending: mock(async (_olderThan: Date): Promise<BackofficeEmailCampaign[]> => []),
  }

  const dispatchRepository = {
    create: mock(async (_data: unknown) => buildDispatch()),
    findById: mock(async (_id: string): Promise<BackofficeEmailCampaignDispatch | null> => buildDispatch()),
    findByCampaignId: mock(async (_campaignId: string): Promise<BackofficeEmailCampaignDispatch[]> => [buildDispatch()]),
    updateStatus: mock(async (_id: string, _status: string, _errorMessage?: string | null) => {}),
    updateCounters: mock(async (_id: string, _counters: Record<string, number>) => {}),
    incrementCounters: mock(async (_id: string, _counters: Record<string, number>) => {}),
  }

  const logRepository = {
    createQueuedBatch: mock(async (entries: Array<{ contactId: string; recipientEmail: string }>) =>
      entries.map((entry, index) => ({ id: `log-${index}`, ...entry }))
    ),
    findQueuedByDispatchId: mock(async (_dispatchId: string, _take: number) => [] as Array<{
      id: string
      contactId: string
      recipientEmail: string
    }>),
    countQueuedByDispatchId: mock(async (_dispatchId: string) => 0),
    countSentByDispatchId: mock(async (_dispatchId: string) => 2),
  }

  const eventRepository = {}

  const contactRepository = {
    listActiveByListId: mock(async (_listId: string) => [
      { id: "contact-1", email: "a@example.com", name: "A" },
      { id: "contact-2", email: "b@example.com", name: "B" },
    ]),
  }

  const contactListRepository = {}

  const dispatchService = {
    dispatchBatch: mock(async (_params: unknown) => ({ sent: 2, failed: 0 })),
  }

  return {
    campaignRepository,
    dispatchRepository,
    logRepository,
    eventRepository,
    contactRepository,
    contactListRepository,
    dispatchService,
  }
}

function makeUseCase(repos: ReturnType<typeof makeRepositories>) {
  return new BackofficeEmailCampaignUseCase(
    repos.campaignRepository as never,
    repos.dispatchRepository as never,
    repos.logRepository as never,
    repos.eventRepository as never,
    repos.contactRepository as never,
    repos.contactListRepository as never,
    repos.dispatchService as never
  )
}

beforeEach(() => {
  getTemplateMock.mockClear()
  publishWakeMock.mockClear()
  getTemplateMock.mockImplementation(async () => ({ subject: "Assunto", html: "<p>Corpo</p>" }))
  publishWakeMock.mockImplementation(async () => ({ messageId: "msg-1" }))
})

describe("BackofficeEmailCampaignUseCase — sendNow (queue-first)", () => {
  it("prepara o dispatch, publica wake 'start' e retorna a campanha em sending sem chamar Resend", async () => {
    const repos = makeRepositories()
    const useCase = makeUseCase(repos)

    const result = await useCase.sendNow("campaign-1", "user-1")

    expect(result.isValid).toBe(true)
    expect(repos.campaignRepository.claimForDispatch).toHaveBeenCalledWith("campaign-1")
    expect(repos.dispatchRepository.create).toHaveBeenCalledTimes(1)
    expect(repos.logRepository.createQueuedBatch).toHaveBeenCalledTimes(1)
    expect(repos.dispatchService.dispatchBatch).not.toHaveBeenCalled()
    expect(publishWakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchId: "dispatch-1", reason: "start" })
    )
  })

  it("retorna erro sem reivindicar quando a campanha não tem template", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findById.mockImplementation(async () => buildCampaign({ resendTemplateId: null }))
    const useCase = makeUseCase(repos)

    const result = await useCase.sendNow("campaign-1", "user-1")

    expect(result.isValid).toBe(false)
    expect(repos.campaignRepository.claimForDispatch).not.toHaveBeenCalled()
  })

  it("retorna erro quando claimForDispatch falha (já em sending)", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.claimForDispatch.mockImplementation(async () => false)
    const useCase = makeUseCase(repos)

    const result = await useCase.sendNow("campaign-1", "user-1")

    expect(result.isValid).toBe(false)
    expect(repos.dispatchRepository.create).not.toHaveBeenCalled()
  })

  it("marca failed e não publica wake quando o template falha no Resend", async () => {
    const repos = makeRepositories()
    getTemplateMock.mockImplementation(async () => {
      throw new Error("template inexistente")
    })
    const useCase = makeUseCase(repos)

    const result = await useCase.sendNow("campaign-1", "user-1")

    expect(result.isValid).toBe(false)
    expect(repos.campaignRepository.markFailed).toHaveBeenCalledWith("campaign-1", "template inexistente")
    expect(publishWakeMock).not.toHaveBeenCalled()
  })

  it("marca failed quando não há destinatário ativo na lista", async () => {
    const repos = makeRepositories()
    repos.contactRepository.listActiveByListId.mockImplementation(async () => [])
    const useCase = makeUseCase(repos)

    const result = await useCase.sendNow("campaign-1", "user-1")

    expect(result.isValid).toBe(false)
    expect(repos.campaignRepository.markFailed).toHaveBeenCalledWith(
      "campaign-1",
      "Nenhum destinatário ativo na lista"
    )
  })
})

describe("BackofficeEmailCampaignUseCase — dispatchDueCampaigns (queue-first)", () => {
  it("prepara cada campanha devida e publica wake 'cron-start'", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findDueForDispatch.mockImplementation(async () => [
      buildCampaign({ id: "campaign-a" }),
      buildCampaign({ id: "campaign-b" }),
    ])
    const useCase = makeUseCase(repos)

    const result = await useCase.dispatchDueCampaigns(new Date())

    expect(result.isValid).toBe(true)
    expect(result.result).toMatchObject({ dispatched: 2, total: 2 })
    expect(publishWakeMock).toHaveBeenCalledTimes(2)
    expect(publishWakeMock).toHaveBeenCalledWith(expect.objectContaining({ reason: "cron-start" }))
    expect(repos.dispatchService.dispatchBatch).not.toHaveBeenCalled()
  })

  it("pula campanhas cujo claim falha e não conta como despachada", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findDueForDispatch.mockImplementation(async () => [buildCampaign({ id: "campaign-a" })])
    repos.campaignRepository.claimForDispatch.mockImplementation(async () => false)
    const useCase = makeUseCase(repos)

    const result = await useCase.dispatchDueCampaigns(new Date())

    expect(result.result).toMatchObject({ dispatched: 0, total: 1 })
    expect(publishWakeMock).not.toHaveBeenCalled()
  })
})

describe("BackofficeEmailCampaignUseCase — processDispatchQueueBatch (consumer)", () => {
  it("acka silenciosamente quando o dispatch não existe ou não está mais sending", async () => {
    const repos = makeRepositories()
    repos.dispatchRepository.findById.mockImplementation(async () => null)
    const useCase = makeUseCase(repos)

    const result = await useCase.processDispatchQueueBatch("dispatch-1")

    expect(result.isValid).toBe(true)
    expect(result.result).toMatchObject({ hasMore: false })
    expect(repos.dispatchService.dispatchBatch).not.toHaveBeenCalled()
  })

  it("retorna erro quando a campanha do dispatch não é encontrada", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findById.mockImplementation(async () => null)
    const useCase = makeUseCase(repos)

    const result = await useCase.processDispatchQueueBatch("dispatch-1")

    expect(result.isValid).toBe(false)
  })

  it("processa um lote parcial, incrementa contadores e republica wake 'continue'", async () => {
    const repos = makeRepositories()
    repos.logRepository.findQueuedByDispatchId.mockImplementation(async () => [
      { id: "log-1", contactId: "contact-1", recipientEmail: "a@example.com" },
    ])
    repos.logRepository.countQueuedByDispatchId.mockImplementation(async () => 3)
    repos.dispatchService.dispatchBatch.mockImplementation(async () => ({ sent: 1, failed: 0 }))
    const useCase = makeUseCase(repos)

    const result = await useCase.processDispatchQueueBatch("dispatch-1")

    expect(result.isValid).toBe(true)
    expect(result.result).toMatchObject({ hasMore: true, remaining: 3, batchSent: 1 })
    expect(repos.dispatchRepository.incrementCounters).toHaveBeenCalledWith("dispatch-1", { totalSent: 1 })
    expect(publishWakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchId: "dispatch-1", reason: "continue", remainingCount: 3 })
    )
    expect(repos.dispatchRepository.updateStatus).not.toHaveBeenCalled()
  })

  it("finaliza com sucesso quando não sobra nenhum log queued", async () => {
    const repos = makeRepositories()
    repos.logRepository.findQueuedByDispatchId.mockImplementation(async () => [])
    repos.logRepository.countSentByDispatchId.mockImplementation(async () => 2)
    const useCase = makeUseCase(repos)

    const result = await useCase.processDispatchQueueBatch("dispatch-1")

    expect(result.isValid).toBe(true)
    expect(repos.dispatchRepository.updateStatus).toHaveBeenCalledWith("dispatch-1", "completed", null)
    expect(repos.campaignRepository.markSent).toHaveBeenCalledWith("campaign-1", 1, {
      totalRecipients: 2,
      totalSent: 2,
    })
  })

  it("finaliza com falha total quando nenhum envio foi confirmado", async () => {
    const repos = makeRepositories()
    repos.logRepository.findQueuedByDispatchId.mockImplementation(async () => [])
    repos.logRepository.countSentByDispatchId.mockImplementation(async () => 0)
    const useCase = makeUseCase(repos)

    const result = await useCase.processDispatchQueueBatch("dispatch-1")

    expect(result.isValid).toBe(false)
    expect(repos.dispatchRepository.updateStatus).toHaveBeenCalledWith("dispatch-1", "failed", "2 envio(s) falharam")
    expect(repos.campaignRepository.markFailed).toHaveBeenCalledWith("campaign-1", "2 envio(s) falharam")
  })
})

describe("BackofficeEmailCampaignUseCase — recoverStuckDispatches", () => {
  it("republica wake 'cron-reclaim' quando ainda há logs queued no dispatch sending", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findStuckSending.mockImplementation(async () => [buildCampaign()])
    repos.dispatchRepository.findByCampaignId.mockImplementation(async () => [buildDispatch({ status: "sending" })])
    repos.logRepository.countQueuedByDispatchId.mockImplementation(async () => 5)
    const useCase = makeUseCase(repos)

    const result = await useCase.recoverStuckDispatches()

    expect(result.result).toMatchObject({ reclaimed: 1, failed: 0, total: 1 })
    expect(publishWakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ dispatchId: "dispatch-1", reason: "cron-reclaim", remainingCount: 5 })
    )
    expect(repos.campaignRepository.markFailed).not.toHaveBeenCalled()
  })

  it("finaliza o dispatch quando não há mais logs queued mas ainda está sending (crash antes do finalize)", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findStuckSending.mockImplementation(async () => [buildCampaign()])
    repos.dispatchRepository.findByCampaignId.mockImplementation(async () => [buildDispatch({ status: "sending" })])
    repos.logRepository.countQueuedByDispatchId.mockImplementation(async () => 0)
    repos.logRepository.countSentByDispatchId.mockImplementation(async () => 2)
    const useCase = makeUseCase(repos)

    const result = await useCase.recoverStuckDispatches()

    expect(result.result).toMatchObject({ reclaimed: 1, failed: 0, total: 1 })
    expect(repos.campaignRepository.markSent).toHaveBeenCalledTimes(1)
    expect(publishWakeMock).not.toHaveBeenCalled()
  })

  it("marca failed quando a campanha travada não tem nenhum dispatch (órfã real)", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findStuckSending.mockImplementation(async () => [buildCampaign()])
    repos.dispatchRepository.findByCampaignId.mockImplementation(async () => [])
    const useCase = makeUseCase(repos)

    const result = await useCase.recoverStuckDispatches()

    expect(result.result).toMatchObject({ reclaimed: 0, failed: 1, total: 1 })
    expect(repos.campaignRepository.markFailed).toHaveBeenCalledWith(
      "campaign-1",
      "Disparo travado sem dispatch ativo — marcado como falho automaticamente"
    )
  })

  it("reconcilia (não marca failed) quando o dispatch já está completed mas a campanha ficou sending por crash antes do markSent", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findStuckSending.mockImplementation(async () => [buildCampaign()])
    repos.dispatchRepository.findByCampaignId.mockImplementation(async () => [
      buildDispatch({ status: "completed" }),
    ])
    repos.logRepository.countSentByDispatchId.mockImplementation(async () => 2)
    const useCase = makeUseCase(repos)

    const result = await useCase.recoverStuckDispatches()

    expect(result.result).toMatchObject({ reclaimed: 1, failed: 0, total: 1 })
    expect(repos.campaignRepository.markFailed).not.toHaveBeenCalled()
    expect(repos.campaignRepository.markSent).toHaveBeenCalledTimes(1)
  })

  it("reconcilia como failed quando o dispatch já está failed mas a campanha ficou sending por crash antes do markFailed", async () => {
    const repos = makeRepositories()
    repos.campaignRepository.findStuckSending.mockImplementation(async () => [buildCampaign()])
    repos.dispatchRepository.findByCampaignId.mockImplementation(async () => [
      buildDispatch({ status: "failed", totalRecipients: 2 }),
    ])
    repos.logRepository.countSentByDispatchId.mockImplementation(async () => 0)
    const useCase = makeUseCase(repos)

    const result = await useCase.recoverStuckDispatches()

    expect(result.result).toMatchObject({ reclaimed: 1, failed: 0, total: 1 })
    expect(repos.campaignRepository.markFailed).toHaveBeenCalledWith("campaign-1", "2 envio(s) falharam")
  })
})
