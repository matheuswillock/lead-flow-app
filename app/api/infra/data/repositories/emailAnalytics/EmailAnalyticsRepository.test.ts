import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * A dedupe por destinatário saiu do JS para o Postgres (SPEC 30 — E4/DA4): o
 * método não carrega mais as linhas do período. Estes testes travam a *consulta*
 * — escopo de formulários do time, tipo de evento, janela e filtro de campanha.
 * A equivalência com o algoritmo antigo de dedupe é provada contra um banco real
 * em `publicForms/metric-aggregation.integration.test.ts` (T-M4.1).
 */

const queryRawMock = mock(async () => [{ recipients: 0 }] as Array<{ recipients: number }>)
const findManyFormsMock = mock(async () => [] as Array<{ id: string }>)
const findFirstFormMock = mock(async () => null as { id: string } | null)
const findManyCampaignsMock = mock(async () => [] as Array<{ id: string }>)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicForm: {
      findMany: findManyFormsMock,
      findFirst: findFirstFormMock,
    },
    emailCampaign: {
      findMany: findManyCampaignsMock,
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
