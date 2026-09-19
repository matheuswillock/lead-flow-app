import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("@/lib/utils/app-url", () => ({
  getAppUrl: () => "https://app.example.test",
}))

const sendDelinquencyReminderEmailMock = mock(
  async (_data: { userEmail: string; tier: string; [key: string]: unknown }) => ({
    success: true,
    error: undefined as string | undefined,
  })
)
mock.module("@/lib/services/EmailService", () => ({
  createEmailService: () => ({
    sendDelinquencyReminderEmail: sendDelinquencyReminderEmailMock,
  }),
}))

const findPastDueSubscriptionsForDunningMock = mock(
  async (_params: { take: number; notBefore: Date; skip?: number }) => [] as unknown[]
)
const hasDelinquencyNoticeSinceMock = mock(
  async (_params: { profileId: string; eventType: string; changeType: string; since: Date }) => false
)
const recordDelinquencyNoticeMock = mock(
  async (_input: { profileId: string; eventType: string; [key: string]: unknown }) => {}
)
mock.module("@/app/api/infra/data/repositories/billing/BillingEngineRepository", () => ({
  billingEngineRepository: {
    findPastDueSubscriptionsForDunning: findPastDueSubscriptionsForDunningMock,
    hasDelinquencyNoticeSince: hasDelinquencyNoticeSinceMock,
    recordDelinquencyNotice: recordDelinquencyNoticeMock,
  },
}))

const { OverdueReminderUseCase } = await import("./OverdueReminderUseCase")

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    profileId: "profile-1",
    asaasSubscriptionId: "sub_1",
    subscriptionStartDate: new Date("2026-01-01"),
    subscriptionNextDueDate: daysAgo(10),
    profile: {
      email: "cliente@example.com",
      fullName: "Cliente Exemplo",
      supabaseId: "supabase-1",
      timezone: "America/Sao_Paulo",
      subscriptionNextDueDate: null,
    },
    ...overrides,
  }
}

describe("OverdueReminderUseCase.processOverdueReminders — Fase 4 (T-20.28)", () => {
  beforeEach(() => {
    findPastDueSubscriptionsForDunningMock.mockReset()
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])
    hasDelinquencyNoticeSinceMock.mockReset()
    hasDelinquencyNoticeSinceMock.mockImplementation(async () => false)
    sendDelinquencyReminderEmailMock.mockReset()
    sendDelinquencyReminderEmailMock.mockImplementation(async () => ({
      success: true,
      error: undefined,
    }))
    recordDelinquencyNoticeMock.mockReset()
    recordDelinquencyNoticeMock.mockImplementation(async () => {})
  })

  it("dia 10 (crm_only) sem aviso prévio → envia e-mail com tier crm_only e loga eventType reduced", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(output.isValid).toBe(true)
    expect(sendDelinquencyReminderEmailMock).toHaveBeenCalledTimes(1)
    expect(sendDelinquencyReminderEmailMock.mock.calls[0][0]).toMatchObject({
      userEmail: "cliente@example.com",
      tier: "crm_only",
    })
    expect(recordDelinquencyNoticeMock).toHaveBeenCalledTimes(1)
    expect(recordDelinquencyNoticeMock.mock.calls[0][0]).toMatchObject({
      profileId: "profile-1",
      eventType: "reduced",
    })
  })

  it("dia 20 (cut_off) sem aviso prévio → envia e-mail com tier cut_off e loga eventType cut", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [
      makeRow({ subscriptionNextDueDate: daysAgo(20) }),
    ])

    const useCase = new OverdueReminderUseCase()
    await useCase.processOverdueReminders()

    expect(sendDelinquencyReminderEmailMock.mock.calls[0][0]).toMatchObject({ tier: "cut_off" })
    expect(recordDelinquencyNoticeMock.mock.calls[0][0]).toMatchObject({ eventType: "cut" })
  })

  it("dia 2 (dentro da tolerância, full_access) → não envia nenhum e-mail", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [
      makeRow({ subscriptionNextDueDate: daysAgo(2) }),
    ])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(sendDelinquencyReminderEmailMock).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({ sent: 0 })
  })

  it("já existe aviso 'reduced' neste ciclo (dedupe) → não reenvia. Controle negativo: dedupe desligado reenviaria", async () => {
    hasDelinquencyNoticeSinceMock.mockImplementation(async () => true)
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(sendDelinquencyReminderEmailMock).not.toHaveBeenCalled()
    expect(recordDelinquencyNoticeMock).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({ sent: 0, deduped: 1 })
  })

  it("falha no envio → não registra o eventType na timeline (nada de log falso-positivo)", async () => {
    sendDelinquencyReminderEmailMock.mockImplementation(async () => ({
      success: false,
      error: "boom",
    }))
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(recordDelinquencyNoticeMock).not.toHaveBeenCalled()
    expect(output.result).toMatchObject({ failed: 1 })
  })

  it("query recebe notBefore = hoje - 5 dias: o SQL já exclui a janela de tolerância (achado cursor/codex PR #1198)", async () => {
    const useCase = new OverdueReminderUseCase()
    await useCase.processOverdueReminders()

    const params = findPastDueSubscriptionsForDunningMock.mock.calls[0][0]
    const cutoffDaysAgo = (Date.now() - params.notBefore.getTime()) / (24 * 60 * 60 * 1000)
    expect(cutoffDaysAgo).toBeGreaterThan(4.9)
    expect(cutoffDaysAgo).toBeLessThan(5.1)
  })

  it("dedupe é restrito ao changeType do lembrete — evento reduced/cut do PaymentValidationService não conta (achado codex P2)", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])

    const useCase = new OverdueReminderUseCase()
    await useCase.processOverdueReminders()

    expect(hasDelinquencyNoticeSinceMock.mock.calls[0][0]).toMatchObject({
      changeType: "delinquency_tier_reminder",
    })
  })

  it("falha ao gravar a marca de dedupe é contada e visível — não vira 'enviado' silencioso (achado codex P2)", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])
    recordDelinquencyNoticeMock.mockImplementation(async () => {
      throw new Error("db down")
    })

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(output.result).toMatchObject({ sent: 1, noticeLogFailed: 1 })
  })

  /**
   * Achado P1 da revisão do lote unificado (PR #1207): o dedupe só acontece
   * depois da query, então com mais inadimplentes que o tamanho da página as
   * mesmas linhas já avisadas ocupavam o lote todo dia e ninguém novo recebia
   * aviso. A paginação tem de atravessar a página inteira de já avisados.
   */
  it("pagina por cima de uma página inteira de já avisados e alcança quem entrou depois", async () => {
    const PAGE_SIZE = 200
    const notifiedPage = Array.from({ length: PAGE_SIZE }, (_, index) =>
      makeRow({ profileId: `ja-avisado-${index}`, subscriptionNextDueDate: daysAgo(40) }),
    )
    const freshRow = makeRow({ profileId: "novo-inadimplente", subscriptionNextDueDate: daysAgo(10) })

    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) => {
      expect(params.take).toBe(PAGE_SIZE)
      return (params.skip ?? 0) === 0 ? notifiedPage : [freshRow]
    })
    hasDelinquencyNoticeSinceMock.mockImplementation(
      async (params: { profileId: string }) => params.profileId !== "novo-inadimplente",
    )

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as { sent: number; deduped: number; scanned: number }
    expect(result.sent).toBe(1)
    expect(result.deduped).toBe(PAGE_SIZE)
    expect(result.scanned).toBe(PAGE_SIZE + 1)
    expect(sendDelinquencyReminderEmailMock.mock.calls).toHaveLength(1)
    expect(sendDelinquencyReminderEmailMock.mock.calls[0][0]).toMatchObject({
      userEmail: "cliente@example.com",
    })
  })

})
