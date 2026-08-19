import { beforeEach, describe, expect, it, mock } from "bun:test"

const findManyEventsMock = mock(async () => [] as Array<{ visitorSessionId: string; origin: unknown }>)
const findManyFormsMock = mock(async () => [] as Array<{ id: string }>)
const findManyCampaignsMock = mock(async () => [] as Array<{ id: string }>)

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
