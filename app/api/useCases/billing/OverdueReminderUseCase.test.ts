import { beforeEach, describe, expect, it, mock } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

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
// Achado P1 (chatgpt-codex-connector, thread PRRT_...CUk5): resolveStartCursor
// lê a última execução COM SUCESSO deste cron para retomar de onde parou —
// sem isso, o teto fixo de varredura sempre relê o mesmo prefixo antigo.
const cronExecutionFindManyMock = mock(
  async (_params: { cronKey?: string; status?: string; limit?: number }) =>
    [] as Array<{ metadata: unknown }>
)
mock.module(
  "@/app/api/infra/data/repositories/backoffice/backofficeCronExecution/BackofficeCronExecutionRepository",
  () => ({
    backofficeCronExecutionRepository: { findMany: cronExecutionFindManyMock },
  })
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

const { OverdueReminderUseCase, DUNNING_CRON_KEY } = await import("./OverdueReminderUseCase")

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
    cronExecutionFindManyMock.mockReset()
    cronExecutionFindManyMock.mockImplementation(async () => [])
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
   * Achado P1 da revisão do PR #1207, 2ª rodada (chatgpt-codex-connector,
   * thread PRRT_...CUk6): quando o envio dá certo mas recordDelinquencyNotice
   * falha, o catch só incrementava o contador e o use case ainda devolvia um
   * Output válido — `withCronAudit` marcava o cron como sucesso e nunca
   * chamava o callback de falha (Slack). Como a idempotência do Resend dura
   * só 24h, o cliente sem marca pode receber o MESMO e-mail de cobrança de
   * novo no dia seguinte, sem ninguém ser avisado do problema real (a marca
   * não gravou).
   */
  it("achado P1 PRRT_...CUk6: falha ao gravar a marca invalida o Output — withCronAudit precisa marcar falha e alertar", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])
    recordDelinquencyNoticeMock.mockImplementation(async () => {
      throw new Error("db down")
    })

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain("1")
    // O e-mail FOI enviado — a falha é só na marca. O resultado continua
    // relatando o que aconteceu de fato, não devolve `result: null`.
    expect(output.result).toMatchObject({ sent: 1, noticeLogFailed: 1 })
  })

  it("controle negativo: marca gravada com sucesso mantém isValid=true (não regride o caminho feliz)", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(output.isValid).toBe(true)
    expect(output.result).toMatchObject({ sent: 1, noticeLogFailed: 0 })
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

  /**
   * Achado P1 da revisão do PR #1207, 2ª rodada (chatgpt-codex-connector,
   * thread PRRT_...CUk5): "fresh evidence": DUNNING_MAX_SCAN=2000 é um teto
   * FIXO por execução — quando o backlog de já avisados excede 2000, toda
   * execução diária varre o MESMO prefixo estável (sempre skip:0..2000),
   * deduplica tudo e nunca alcança quem está depois da linha 2000. É a
   * mesma inanição de uma revisão anterior, só que com limiar maior.
   */
  it("controle negativo: sem execução anterior bem-sucedida, começa do zero (comportamento do dia 1 preservado)", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])

    const useCase = new OverdueReminderUseCase()
    await useCase.processOverdueReminders()

    expect(findPastDueSubscriptionsForDunningMock.mock.calls[0][0]).toMatchObject({ skip: 0 })
  })

  it("bate no teto de varredura sem chegar ao fim da lista → persiste o cursor onde parou, não zera", async () => {
    // Backlog "infinito": toda página vem cheia (200) e sempre já avisada,
    // não importa o skip — simula mais de 2000 inadimplentes antigos.
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params: { skip?: number }) =>
      Array.from({ length: 200 }, (_, i) => makeRow({ profileId: `antigo-${params.skip}-${i}` }))
    )
    hasDelinquencyNoticeSinceMock.mockImplementation(async () => true)

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as { scanned: number; deduped: number; nextDunningScanCursor: number }
    expect(result.scanned).toBe(2000)
    expect(result.deduped).toBe(2000)
    // Não é o mesmo prefixo de novo amanhã — a próxima execução retoma daqui.
    expect(result.nextDunningScanCursor).toBe(2000)
  })

  it("achado P1 PRRT_...CUk5: cursor persistido da execução anterior é usado como skip inicial — não relê o prefixo já varrido", async () => {
    cronExecutionFindManyMock.mockImplementation(async () => [
      { metadata: { nextDunningScanCursor: 2000 } },
    ])
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])

    const useCase = new OverdueReminderUseCase()
    await useCase.processOverdueReminders()

    expect(cronExecutionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", limit: 1 })
    )
    expect(findPastDueSubscriptionsForDunningMock.mock.calls[0][0]).toMatchObject({ skip: 2000 })
  })

  it("chega ao fim da lista antes do teto → cursor reseta para 0 (fecha a volta e recomeça do início amanhã)", async () => {
    cronExecutionFindManyMock.mockImplementation(async () => [
      { metadata: { nextDunningScanCursor: 2000 } },
    ])
    // Página curta (< 200) = fim de lista alcançado nesta execução.
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect((output.result as { nextDunningScanCursor: number }).nextDunningScanCursor).toBe(0)
  })

  it("cursor persistido inválido (não numérico) é ignorado com segurança — não trava o cron", async () => {
    cronExecutionFindManyMock.mockImplementation(async () => [{ metadata: { foo: "bar" } }])
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(output.isValid).toBe(true)
    expect(findPastDueSubscriptionsForDunningMock.mock.calls[0][0]).toMatchObject({ skip: 0 })
  })

  /**
   * Achado P1 da 3ª rodada (chatgpt-codex-connector, thread PRRT_...YP_m):
   * o cursor avançava pela página INTEIRA antes de o laço parar no orçamento
   * de e-mails. Com parte do orçamento já gasta, só uma fração da página
   * seguinte é processada — mas o cursor pulava o resto, adiando o aviso
   * dessas linhas até uma volta completa. Tem de avançar pelas linhas
   * efetivamente PROCESSADAS.
   */
  it("achado P1 PRRT_...YP_m: orçamento parcialmente gasto não faz o cursor pular as linhas não processadas", async () => {
    // Toda página tem 200 linhas. As 50 primeiras do backlog já foram
    // avisadas (dedupe não gasta orçamento); o resto envia. Orçamento = 200.
    // Página 1 (skip 0): 50 deduped + 150 enviados → processa as 200.
    // Página 2 (skip 200): o orçamento permite só mais 50 envios → o laço
    // para depois de 50 linhas. Cursor tem de ficar em 250, não 400.
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params: { skip?: number }) => {
      const base = params.skip ?? 0
      return Array.from({ length: 200 }, (_, i) => makeRow({ profileId: `linha-${base + i}` }))
    })
    hasDelinquencyNoticeSinceMock.mockImplementation(async (params: { profileId: string }) => {
      const index = Number(params.profileId.replace("linha-", ""))
      return index < 50
    })

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as {
      sent: number
      deduped: number
      scanned: number
      nextDunningScanCursor: number
    }
    expect(result.deduped).toBe(50)
    expect(result.sent).toBe(200)
    // 200 da página 1 + 50 efetivamente processadas da página 2.
    expect(result.nextDunningScanCursor).toBe(250)
    expect(result.scanned).toBe(250)
  })

  it("controle negativo: página consumida por inteiro (sem corte de orçamento) avança o cursor pela página toda", async () => {
    // Sem truncamento: todas já avisadas, dedupe não gasta orçamento, então
    // as 200 linhas de cada página são processadas e o cursor avança 200 por
    // página até o teto de varredura — comportamento anterior, que continua
    // correto quando não há corte no meio da página.
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params: { skip?: number }) =>
      Array.from({ length: 200 }, (_, i) => makeRow({ profileId: `antigo-${params.skip}-${i}` }))
    )
    hasDelinquencyNoticeSinceMock.mockImplementation(async () => true)

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as { scanned: number; nextDunningScanCursor: number }
    expect(result.scanned).toBe(2000)
    expect(result.nextDunningScanCursor).toBe(2000)
  })

  it("DUNNING_CRON_KEY bate com o cronKey literal da rota — resolveStartCursor não pode ler a execução do cron errado", () => {
    // cronAuditCoverage.test.ts exige `cronKey: "..."` literal na rota (regex
    // estática), então a rota não pode importar esta constante — o teste
    // aqui é quem trava os dois lados não divergirem silenciosamente.
    const routeSource = readFileSync(
      join(process.cwd(), "app/api/v1/billing/cron/overdue-reminder/route.ts"),
      "utf8",
    )
    const literalCronKey = /cronKey:\s*"([^"]+)"/.exec(routeSource)?.[1]

    expect(literalCronKey).toBe(DUNNING_CRON_KEY)
  })

})
