import { beforeEach, describe, expect, it, mock } from "bun:test"

const findManyEventsMock = mock(async () => [] as Array<{ visitorSessionId: string; origin: unknown }>)
const findManyFormsMock = mock(async () => [] as Array<{ id: string }>)
const findManyCampaignsMock = mock(async () => [] as Array<{ id: string }>)
const countLogsMock = mock(async () => 0)
const findManyDispatchesMock = mock(async () => [] as Array<Record<string, unknown>>)
const queryRawMock = mock(async () => [] as Array<Record<string, unknown>>)

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    publicFormMetricEvent: {
      findMany: findManyEventsMock,
    },
    publicForm: {
      findMany: findManyFormsMock,
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

function eventRows(count: number, email = "user@test.com") {
  return Array.from({ length: count }, (_, index) => ({
    visitorSessionId: `session-${index}`,
    origin: { recipientEmail: email },
  }))
}

type CountLogsCall = [
  {
    where: {
      teamId: string
      sentAt?: { gte: Date; lte: Date }
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
    expect(call.where.sentAt).toBeUndefined()
    expect(call.where.status).toBe("failed")
  })

  it("T-M1.1-b — suppressed e queued também ancoram em createdAt", async () => {
    const repo = new EmailAnalyticsRepository()
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "suppressed")
    await repo.countLogs({ teamId: "team-1", ...dateRange }, "queued")

    const calls = countLogsMock.mock.calls as unknown as CountLogsCall[]
    expect(calls[0][0].where.createdAt).toEqual({ gte: dateRange.from, lte: dateRange.to })
    expect(calls[0][0].where.sentAt).toBeUndefined()
    expect(calls[0][0].where.status).toBe("suppressed")
    expect(calls[1][0].where.createdAt).toEqual({ gte: dateRange.from, lte: dateRange.to })
    expect(calls[1][0].where.sentAt).toBeUndefined()
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
    findManyEventsMock.mockClear()
    findManyFormsMock.mockClear()
    findManyCampaignsMock.mockClear()
    findManyEventsMock.mockImplementation(async () => [])
    findManyFormsMock.mockImplementation(async () => [{ id: "form-1" }, { id: "form-2" }])
    findManyCampaignsMock.mockImplementation(async () => [])
  })

  it("G0-1 — form_viewed conta destinatários únicos, não cada visualização", async () => {
    findManyEventsMock.mockImplementation(async () => [
      ...eventRows(10, "ana@test.com"),
      ...eventRows(5, "bob@test.com"),
    ])

    const repo = new EmailAnalyticsRepository()
    const result = await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_viewed",
      ...dateRange,
    })

    expect(result).toBe(2)
    expect(findManyEventsMock).toHaveBeenCalledTimes(1)
    const calls = findManyEventsMock.mock.calls as unknown as Array<
      [
        {
          where: {
            formId: { in: string[] }
            eventType: string
            createdAt: { gte: Date; lte: Date }
          }
          select: { visitorSessionId: true; origin: true }
        },
      ]
    >
    const call = calls[0][0]
    expect(call.where.eventType).toBe("form_viewed")
    expect(call.where.formId.in).toEqual(["form-1", "form-2"])
    expect(call.where.createdAt.gte).toEqual(dateRange.from)
    expect(call.where.createdAt.lte).toEqual(dateRange.to)
    expect(call.select).toEqual({ visitorSessionId: true, origin: true })
  })

  it("G0-2 — form_started retorna contagem independente de form_viewed", async () => {
    findManyEventsMock.mockImplementation(async (args?: { where?: { eventType?: string } }) => {
      if (args?.where?.eventType === "form_viewed") {
        return [
          ...eventRows(10, "a@test.com"),
          ...eventRows(8, "b@test.com"),
          ...eventRows(11, "c@test.com"),
        ]
      }
      if (args?.where?.eventType === "form_started") {
        return [...eventRows(4, "a@test.com"), ...eventRows(2, "d@test.com")]
      }
      return []
    })

    const repo = new EmailAnalyticsRepository()

    const viewed = await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_viewed",
      ...dateRange,
    })
    const started = await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_started",
      ...dateRange,
    })

    expect(viewed).toBe(3)
    expect(started).toBe(2)
    expect(findManyEventsMock).toHaveBeenCalledTimes(2)
  })

  it("G0-3 — formId restringe ao formulário informado", async () => {
    findManyEventsMock.mockImplementation(async () => eventRows(4))

    const repo = new EmailAnalyticsRepository()
    await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_viewed",
      formId: "form-linked",
      ...dateRange,
    })

    expect(findManyFormsMock).not.toHaveBeenCalled()
    const calls = findManyEventsMock.mock.calls as unknown as Array<[{ where: { formId: string } }]>
    expect(calls[0][0].where.formId).toBe("form-linked")
  })

  it("G0-4 — campaignId restringe eventos atribuídos à campanha (inclui sub-campanhas)", async () => {
    findManyCampaignsMock.mockImplementation(async () => [{ id: "sub-camp-1" }])
    findManyEventsMock.mockImplementation(async () => eventRows(12))

    const repo = new EmailAnalyticsRepository()
    const result = await repo.countFormEvents({
      teamId: "team-1",
      eventType: "form_started",
      campaignId: "camp-parent",
      formId: "form-linked",
      ...dateRange,
    })

    expect(result).toBe(1)
    const calls = findManyEventsMock.mock.calls as unknown as Array<
      [
        {
          where: {
            OR: Array<{ origin: { path: string[]; equals: string } }>
          }
        },
      ]
    >
    expect(calls[0][0].where.OR).toEqual([
      { origin: { path: ["campaignId"], equals: "camp-parent" } },
      { origin: { path: ["campaignId"], equals: "sub-camp-1" } },
    ])
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
    expect(findManyEventsMock).not.toHaveBeenCalled()
  })
})
