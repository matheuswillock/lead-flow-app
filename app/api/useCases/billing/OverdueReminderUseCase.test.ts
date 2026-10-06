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

type DunningCursor = { subscriptionNextDueDate: Date | null; profileId: string }
const findPastDueSubscriptionsForDunningMock = mock(
  async (_params: { take: number; notBefore: Date; after?: DunningCursor }) => [] as unknown[]
)

/**
 * Simula paginação por KEYSET sobre um dataset fixo, como o Postgres faria
 * (achado P1 PRRT_...aTIo: o cursor deixou de ser offset numérico). Ordena
 * por `(subscriptionNextDueDate asc nulls last, profileId asc)` e devolve as
 * `take` linhas estritamente APÓS a chave recebida.
 */
function keysetPage(rows: ReturnType<typeof makeRow>[], params: { take: number; after?: DunningCursor }) {
  const key = (r: { subscriptionNextDueDate: Date | null; profileId: string }) => [
    r.subscriptionNextDueDate === null ? 1 : 0,
    r.subscriptionNextDueDate === null ? 0 : r.subscriptionNextDueDate.getTime(),
    r.profileId,
  ]
  const cmp = (a: ReturnType<typeof key>, b: ReturnType<typeof key>) => {
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] < b[i]) return -1
      if (a[i] > b[i]) return 1
    }
    return 0
  }
  const sorted = [...rows].sort((a, b) => cmp(key(a), key(b)))
  const start = params.after ? sorted.findIndex((r) => cmp(key(r), key(params.after!)) > 0) : 0
  if (start === -1) return []
  return sorted.slice(start, start + params.take)
}
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

    // `notifiedPage` é toda de 40 dias atrás e `freshRow` de 10 — o keyset
    // ordena por data, então as avisadas vêm primeiro e a nova depois.
    const dataset = [...notifiedPage, freshRow]
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) => {
      expect(params.take).toBe(PAGE_SIZE)
      return keysetPage(dataset, params)
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
  it("controle negativo: sem execução anterior bem-sucedida, começa do começo (comportamento do dia 1 preservado)", async () => {
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])

    const useCase = new OverdueReminderUseCase()
    await useCase.processOverdueReminders()

    expect(findPastDueSubscriptionsForDunningMock.mock.calls[0][0].after).toBeUndefined()
  })

  it("bate no teto de varredura sem chegar ao fim da lista → persiste a chave onde parou, não zera", async () => {
    // Backlog "infinito": 3000 linhas antigas, todas já avisadas.
    const dataset = Array.from({ length: 3000 }, (_, i) =>
      makeRow({
        profileId: `antigo-${String(i).padStart(4, "0")}`,
        subscriptionNextDueDate: daysAgo(40),
      })
    )
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) =>
      keysetPage(dataset, params)
    )
    hasDelinquencyNoticeSinceMock.mockImplementation(async () => true)

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as {
      scanned: number
      deduped: number
      nextDunningScanCursor: DunningCursor | null
    }
    expect(result.scanned).toBe(2000)
    expect(result.deduped).toBe(2000)
    // Não é o mesmo prefixo de novo amanhã — a próxima execução retoma da
    // CHAVE da última linha processada (a 2000ª, índice 1999).
    expect(result.nextDunningScanCursor).toMatchObject({ profileId: "antigo-1999" })
  })

  it("achado P1 PRRT_...CUk5: chave persistida da execução anterior vira o `after` inicial — não relê o prefixo já varrido", async () => {
    const persisted = { profileId: "antigo-1999", subscriptionNextDueDate: daysAgo(40).toISOString() }
    cronExecutionFindManyMock.mockImplementation(async () => [
      { metadata: { nextDunningScanCursor: persisted } },
    ])
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])

    const useCase = new OverdueReminderUseCase()
    await useCase.processOverdueReminders()

    expect(cronExecutionFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", limit: 1 })
    )
    const after = findPastDueSubscriptionsForDunningMock.mock.calls[0][0].after
    expect(after?.profileId).toBe("antigo-1999")
    // JSON devolve string ISO; o use case reidrata para Date.
    expect(after?.subscriptionNextDueDate).toBeInstanceOf(Date)
  })

  /**
   * Achado P1 da 5ª rodada (chatgpt-codex-connector, thread PRRT_...aTIo):
   * o cursor era um OFFSET numérico contra um conjunto mutável. Se quem
   * estava antes do offset paga entre execuções, as linhas seguintes
   * deslizam para a esquerda e o offset do dia seguinte pula gente que
   * nunca foi avisada. A chave de ordenação é imune a isso.
   */
  it("achado P1 PRRT_...aTIo: linhas que saem da fila entre execuções não fazem o cursor pular ninguém", async () => {
    // Dia 1 processou até `antigo-0004`. Entre as execuções, as 3 primeiras
    // linhas pagam e somem da query. Com offset (skip: 5) o dia 2 começaria
    // em `antigo-0007`, pulando 0005 e 0006 — que nunca foram avisados.
    const persisted = {
      profileId: "antigo-0004",
      subscriptionNextDueDate: daysAgo(40).toISOString(),
    }
    cronExecutionFindManyMock.mockImplementation(async () => [
      { metadata: { nextDunningScanCursor: persisted } },
    ])
    const remaining = Array.from({ length: 10 }, (_, i) =>
      makeRow({
        profileId: `antigo-${String(i).padStart(4, "0")}`,
        subscriptionNextDueDate: daysAgo(40),
      })
      // as 3 primeiras pagaram e saíram do conjunto
    ).slice(3)
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) =>
      keysetPage(remaining, params)
    )

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    // Retoma exatamente após a chave: 0005 em diante, ninguém pulado.
    expect((output.result as { sent: number }).sent).toBe(5)
    expect(sendDelinquencyReminderEmailMock.mock.calls).toHaveLength(5)
  })

  it("chega ao fim da lista antes do teto → cursor reseta para null (fecha a volta e recomeça do início amanhã)", async () => {
    cronExecutionFindManyMock.mockImplementation(async () => [
      {
        metadata: {
          nextDunningScanCursor: { profileId: "x", subscriptionNextDueDate: daysAgo(40).toISOString() },
        },
      },
    ])
    // Página curta (< 200) = fim de lista alcançado nesta execução.
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [makeRow()])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect((output.result as { nextDunningScanCursor: unknown }).nextDunningScanCursor).toBeNull()
  })

  it("cursor persistido inválido é ignorado com segurança — não trava o cron", async () => {
    cronExecutionFindManyMock.mockImplementation(async () => [{ metadata: { foo: "bar" } }])
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(output.isValid).toBe(true)
    expect(findPastDueSubscriptionsForDunningMock.mock.calls[0][0].after).toBeUndefined()
  })

  it("cursor persistido no formato antigo (número) é descartado — migração sem travar o cron", async () => {
    // Uma execução gravada antes desta mudança tem `nextDunningScanCursor`
    // numérico. Não pode virar chave inválida nem parar o cron: reinicia.
    cronExecutionFindManyMock.mockImplementation(async () => [
      { metadata: { nextDunningScanCursor: 2000 } },
    ])
    findPastDueSubscriptionsForDunningMock.mockImplementation(async () => [])

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    expect(output.isValid).toBe(true)
    expect(findPastDueSubscriptionsForDunningMock.mock.calls[0][0].after).toBeUndefined()
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
    // Dataset de 400 linhas. As 50 primeiras já foram avisadas (dedupe não
    // gasta orçamento); o resto envia. Orçamento = 200.
    // Página 1: 50 deduped + 150 enviados → processa as 200.
    // Página 2: o orçamento permite só mais 50 envios → o laço para depois
    // de 50 linhas. A chave tem de ser a da linha 250, não a da 400.
    const dataset = Array.from({ length: 400 }, (_, i) =>
      makeRow({ profileId: `linha-${String(i).padStart(4, "0")}`, subscriptionNextDueDate: daysAgo(40) })
    )
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) =>
      keysetPage(dataset, params)
    )
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
      nextDunningScanCursor: DunningCursor | null
    }
    expect(result.deduped).toBe(50)
    expect(result.sent).toBe(200)
    // 200 da página 1 + 50 efetivamente processadas da página 2 → a chave
    // é a da 250ª linha (índice 249), não a da última linha da página.
    expect(result.nextDunningScanCursor).toMatchObject({ profileId: "linha-0249" })
    expect(result.scanned).toBe(250)
  })

  it("controle negativo: página consumida por inteiro (sem corte de orçamento) avança o cursor pela página toda", async () => {
    // Sem truncamento: todas já avisadas, dedupe não gasta orçamento, então
    // as 200 linhas de cada página são processadas até o teto de varredura.
    const dataset = Array.from({ length: 3000 }, (_, i) =>
      makeRow({
        profileId: `antigo-${String(i).padStart(4, "0")}`,
        subscriptionNextDueDate: daysAgo(40),
      })
    )
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) =>
      keysetPage(dataset, params)
    )
    hasDelinquencyNoticeSinceMock.mockImplementation(async () => true)

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as { scanned: number; nextDunningScanCursor: DunningCursor | null }
    expect(result.scanned).toBe(2000)
    expect(result.nextDunningScanCursor).toMatchObject({ profileId: "antigo-1999" })
  })

  /**
   * Achado P1 da 4ª rodada (chatgpt-codex-connector, thread PRRT_...ZZPo):
   * o último caso de página parcial. `hasMorePages` sai de `page.length`
   * ANTES do laço, então uma página curta (< PAGE_SIZE, logo "última") que
   * ainda assim tenha mais linhas do que o orçamento restante era
   * processada só no prefixo — e o cursor resetava para 0 mesmo assim,
   * adiando o sufixo não processado por uma volta inteira. O reset só pode
   * acontecer quando TODAS as linhas buscadas foram processadas.
   */
  it("achado P1 PRRT_...ZZPo: página curta truncada pelo orçamento preserva o cursor em vez de resetar", async () => {
    // 210 linhas: página 1 leva 200 (1 deduped + 199 enviados, sobra 1 de
    // orçamento) e a página 2 é CURTA (10). Só 1 das 10 cabe no orçamento
    // → o cursor não pode zerar e esquecer as outras 9.
    const dataset = Array.from({ length: 210 }, (_, i) =>
      makeRow({ profileId: `p-${String(i).padStart(4, "0")}`, subscriptionNextDueDate: daysAgo(40) })
    )
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) =>
      keysetPage(dataset, params)
    )
    hasDelinquencyNoticeSinceMock.mockImplementation(
      async (params: { profileId: string }) => params.profileId === "p-0000"
    )

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as { sent: number; nextDunningScanCursor: DunningCursor | null }
    expect(result.sent).toBe(200)
    // 201 linhas processadas → chave da 201ª (índice 200). Zerar aqui
    // esqueceria as outras 9 por uma volta inteira.
    expect(result.nextDunningScanCursor).toMatchObject({ profileId: "p-0200" })
  })

  it("controle negativo: página curta CONSUMIDA POR INTEIRO reseta o cursor (fim de lista real)", async () => {
    // Sem truncamento: a página curta cabe inteira no orçamento, então é
    // fim de lista de verdade e o cursor fecha a volta em null.
    const dataset = Array.from({ length: 210 }, (_, i) =>
      makeRow({ profileId: `q-${String(i).padStart(4, "0")}`, subscriptionNextDueDate: daysAgo(40) })
    )
    findPastDueSubscriptionsForDunningMock.mockImplementation(async (params) =>
      keysetPage(dataset, params)
    )
    // Tudo deduped: não gasta orçamento, as duas páginas passam inteiras.
    hasDelinquencyNoticeSinceMock.mockImplementation(async () => true)

    const useCase = new OverdueReminderUseCase()
    const output = await useCase.processOverdueReminders()

    const result = output.result as { scanned: number; nextDunningScanCursor: unknown }
    expect(result.scanned).toBe(210)
    expect(result.nextDunningScanCursor).toBeNull()
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
