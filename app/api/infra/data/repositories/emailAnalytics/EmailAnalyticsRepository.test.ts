import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * A dedupe por destinatário saiu do JS para o Postgres (SPEC 30 — E4/DA4): o
 * método não carrega mais as linhas do período. Estes testes travam a *consulta*
 * — escopo de formulários do time, tipo de evento, janela e filtro de campanha.
 * A equivalência com o algoritmo antigo de dedupe é provada contra um banco real
 * em `publicForms/metric-aggregation.integration.test.ts` (T-M4.1).
 */

const findManyFormsMock = mock(async () => [] as Array<{ id: string }>)
const findFirstFormMock = mock(async () => null as { id: string } | null)
const findManyCampaignsMock = mock(async () => [] as Array<{ id: string }>)
const countLogsMock = mock(async () => 0)
const findManyDispatchesMock = mock(async () => [] as Array<Record<string, unknown>>)
/**
 * `$queryRaw` é um só no client, então os dois consumidores dividem este mock:
 * os contadores por disparo (E1) e a contagem de destinatários únicos (E4).
 * Cada suíte define o próprio `mockImplementation` no `beforeEach`.
 */
const queryRawMock = mock(async () => [] as Array<Record<string, unknown>>)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicForm: {
      findMany: findManyFormsMock,
      findFirst: findFirstFormMock,
    },
    emailCampaign: {
      findMany: findManyCampaignsMock,
    },
    emailLog: {
      count: countLogsMock,
    },
    emailCampaignDispatch: {
      findMany: findManyDispatchesMock,
    },
    $queryRaw: queryRawMock,
  },
}))

const { EmailAnalyticsRepository } = await import("./EmailAnalyticsRepository")

const dateRange = {
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2026-01-31T23:59:59.999Z"),
}

function query(callIndex = 0): { sql: string; values: unknown[] } {
  const call = queryRawMock.mock.calls[callIndex] as unknown as [{ sql: string; values: unknown[] }]
  return call[0]
}

const queryText = (callIndex = 0): string => query(callIndex).sql
const queryValues = (callIndex = 0): unknown[] => query(callIndex).values

type CountLogsCall = [
  {
    where: {
      teamId: string
      sentAt?: { gte: Date; lte: Date } | null
      resendEmailId?: string | null
      createdAt?: { gte: Date; lte: Date }
      status?: string
    }
  },
]

describe("EmailAnalyticsRepository.countLogs — âncora por status (T-M1.1)", () => {
  beforeEach(() => {
    countLogsMock.mockClear()
    countLogsMock.mockImplementation(async () => 0)
  })

  it("T-M1.1-a — failed ancora em createdAt (log falho tem sentAt NULL e sumia do período)", async () => {
    const repo = new EmailAnalyticsRepository()
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "failed")

    const call = (countLogsMock.mock.calls as unknown as CountLogsCall[])[0][0]
    expect(call.where.createdAt).toEqual({ gte: dateRange.from, lte: dateRange.to })
    // `sentAt` não é janela aqui — é recorte de população (`null`), não âncora.
    expect(call.where.sentAt).toBeNull()
    expect(call.where.status).toBe("failed")
  })

  it("T-M1.1-a2 — log aceito e marcado failed depois não conta como falha", async () => {
    // `email.failed` pós-aceite promove o status sem limpar `sentAt`. Sem o
    // recorte, o mesmo log entraria em `sent` e em `failed` e a failureRate
    // passaria a somar mais que 100% da tentativa de envio.
    const repo = new EmailAnalyticsRepository()
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "failed")

    const call = (
      countLogsMock.mock.calls as unknown as Array<
        [{ where: { sentAt?: unknown; resendEmailId?: unknown } }]
      >
    )[0][0]
    expect(call.where.sentAt).toBeNull()
    expect(call.where.resendEmailId).toBeNull()
  })

  it("T-M1.1-b — suppressed e queued também ancoram em createdAt", async () => {
    const repo = new EmailAnalyticsRepository()
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "suppressed")
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "queued")

    const calls = countLogsMock.mock.calls as unknown as CountLogsCall[]
    expect(calls[0][0].where.createdAt).toEqual({ gte: dateRange.from, lte: dateRange.to })
    expect(calls[0][0].where.sentAt).toBeNull()
    expect(calls[0][0].where.status).toBe("suppressed")
    expect(calls[1][0].where.createdAt).toEqual({ gte: dateRange.from, lte: dateRange.to })
    expect(calls[1][0].where.sentAt).toBeNull()
    expect(calls[1][0].where.status).toBe("queued")
  })

  it("T-M1.1-c — envio e engajamento continuam ancorados em sentAt", async () => {
    const repo = new EmailAnalyticsRepository()
    await repo.countLogs({ teamId: "team-1", ...dateRange })
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "delivered")
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "opened")

    const calls = countLogsMock.mock.calls as unknown as CountLogsCall[]
    for (const call of calls) {
      expect(call[0].where.sentAt).toEqual({ gte: dateRange.from, lte: dateRange.to })
      expect(call[0].where.createdAt).toBeUndefined()
    }
  })

  it("T-M1.1-d — filtro de campanha permanece aplicado na âncora de createdAt", async () => {
    findManyCampaignsMock.mockImplementation(async () => [{ id: "sub-camp-1" }])

    const repo = new EmailAnalyticsRepository()
    await repo.countLogs(
      { teamId: "team-1", campaignId: "camp-parent", ...dateRange },
      "failed",
    )

    const call = (
      countLogsMock.mock.calls as unknown as Array<[{ where: { campaignId?: unknown } }]>
    )[0][0]
    expect(call.where.campaignId).toEqual({ in: ["camp-parent", "sub-camp-1"] })
  })
})

describe("EmailAnalyticsRepository.listDispatches — contadores de log (T-M1.3)", () => {
  const dispatchRow = {
    id: "disp-1",
    dispatchNumber: 1,
    templateName: "T",
    templateVersionNumber: 1,
    templateSubject: "S",
    contactListName: null,
    radarSegmentSlug: null,
    dispatchedAt: dateRange.from,
    totalRecipients: 37944,
    totalSent: 5031,
    totalDelivered: 4900,
    totalOpened: 1200,
    totalClicked: 300,
    totalBounced: 50,
    totalComplained: 2,
    status: "failed",
    errorMessage: null,
  }

  beforeEach(() => {
    findManyDispatchesMock.mockClear()
    queryRawMock.mockClear()
    findManyCampaignsMock.mockImplementation(async () => [])
    findManyDispatchesMock.mockImplementation(async () => [dispatchRow])
    queryRawMock.mockImplementation(async () => [])
  })

  it("T-M1.3-a — cada disparo carrega failed/suppressed/queued do log", async () => {
    queryRawMock.mockImplementation(async () => [
      {
        dispatchId: "disp-1",
        acceptedCount: 5031,
        failedCount: 32913,
        queuedCount: 0,
        suppressedCount: 0,
      },
    ])

    const repo = new EmailAnalyticsRepository()
    const dispatches = await repo.listDispatches({
      teamId: "team-1",
      campaignId: "camp-1",
      ...dateRange,
    })

    expect(dispatches).toHaveLength(1)
    expect(dispatches[0].failedCount).toBe(32913)
    expect(dispatches[0].suppressedCount).toBe(0)
    expect(dispatches[0].queuedCount).toBe(0)
  })

  it("T-M1.3-b — disparo sem linha de contador reporta zero, não undefined", async () => {
    const repo = new EmailAnalyticsRepository()
    const dispatches = await repo.listDispatches({
      teamId: "team-1",
      campaignId: "camp-1",
      ...dateRange,
    })

    expect(dispatches[0].failedCount).toBe(0)
    expect(dispatches[0].suppressedCount).toBe(0)
    expect(dispatches[0].queuedCount).toBe(0)
  })

  it("T-M1.3-c — sem disparos no período não consulta contadores", async () => {
    findManyDispatchesMock.mockImplementation(async () => [])

    const repo = new EmailAnalyticsRepository()
    const dispatches = await repo.listDispatches({
      teamId: "team-1",
      campaignId: "camp-1",
      ...dateRange,
    })

    expect(dispatches).toEqual([])
    expect(queryRawMock).not.toHaveBeenCalled()
  })
})

describe("EmailAnalyticsRepository.countFormEvents (G0)", () => {
  beforeEach(() => {
    queryRawMock.mockClear()
    findManyFormsMock.mockClear()
    findFirstFormMock.mockClear()
    findManyCampaignsMock.mockClear()
    queryRawMock.mockImplementation(async () => [{ recipients: 0 }])
    findManyFormsMock.mockImplementation(async () => [{ id: "form-1" }, { id: "form-2" }])
    findFirstFormMock.mockImplementation(async () => ({ id: "form-linked" }))
    findManyCampaignsMock.mockImplementation(async () => [])
  })

  it("G0-1 — conta no banco, sem trazer as linhas do período", async () => {
    queryRawMock.mockImplementation(async () => [{ recipients: 2 }])

    const repo = new EmailAnalyticsRepository()
    const result = await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_viewed",
      ...dateRange,
    })

    expect(result).toBe(2)
    expect(queryRawMock).toHaveBeenCalledTimes(1)
    // A chave de deduplicação é a mesma do caminho antigo: e-mail → log → sessão.
    expect(queryText()).toContain("COUNT(DISTINCT")
    expect(queryText()).toContain("recipientEmail")
    expect(queryText()).toContain("emailLogId")
    expect(queryText()).toContain("visitorSessionId")
    expect(queryValues()).toEqual([
      ["form-1", "form-2"],
      "form_viewed",
      dateRange.from,
      dateRange.to,
    ])
  })

  it("G0-2 — form_started consulta o próprio tipo, independente de form_viewed", async () => {
    const repo = new EmailAnalyticsRepository()
    await repo.countFormEvents({ teamId: "team-1", eventType: "form_viewed", ...dateRange })
    await repo.countFormEvents({ teamId: "team-1", eventType: "form_started", ...dateRange })

    expect(queryValues(0)[1]).toBe("form_viewed")
    expect(queryValues(1)[1]).toBe("form_started")
  })

  it("G0-3 — formId restringe ao formulário informado, validando o time", async () => {
    const repo = new EmailAnalyticsRepository()
    await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_viewed",
      formId: "form-linked",
      ...dateRange,
    })

    expect(findManyFormsMock).not.toHaveBeenCalled()
    expect(findFirstFormMock).toHaveBeenCalledWith({
      where: { id: "form-linked", teamId: "team-1" },
      select: { id: true },
    })
    expect(queryValues()[0]).toEqual(["form-linked"])
  })

  it("G0-3b — formulário de outro time não conta nada e não consulta eventos", async () => {
    findFirstFormMock.mockImplementation(async () => null)

    const repo = new EmailAnalyticsRepository()
    const result = await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_viewed",
      formId: "form-de-outro-time",
      ...dateRange,
    })

    expect(result).toBe(0)
    expect(queryRawMock).not.toHaveBeenCalled()
  })

  it("G0-4 — campaignId restringe eventos atribuídos à campanha (inclui sub-campanhas)", async () => {
    findManyCampaignsMock.mockImplementation(async () => [{ id: "sub-camp-1" }])

    const repo = new EmailAnalyticsRepository()
    await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_started",
      campaignId: "camp-parent",
      formId: "form-linked",
      ...dateRange,
    })

    expect(queryText()).toContain("campaignId")
    expect(queryValues().at(-1)).toEqual(["camp-parent", "sub-camp-1"])
  })

  it("G0-5 — sem formulários do time retorna 0 sem consultar eventos", async () => {
    findManyFormsMock.mockImplementation(async () => [])

    const repo = new EmailAnalyticsRepository()
    const result = await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_viewed",
      ...dateRange,
    })

    expect(result).toBe(0)
    expect(queryRawMock).not.toHaveBeenCalled()
  })

  it("G0-6 — countFormCompletions consulta form_completed", async () => {
    const repo = new EmailAnalyticsRepository()
    await repo.countFormCompletions({ teamId: "team-1", ...dateRange })

    expect(queryValues()[1]).toBe("form_completed")
  })
})
