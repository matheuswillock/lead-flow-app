import { beforeEach, describe, expect, mock, test } from "bun:test"

const groupBy = mock()
const create = mock()
const findUnique = mock()

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    landingAnalyticsEvent: { groupBy, create, findUnique },
  },
}))

const { LandingAnalyticsRepository } = await import("./LandingAnalyticsRepository")

const input = {
  teamId: "team-1",
  from: new Date("2026-01-01T00:00:00.000Z"),
  to: new Date("2026-01-02T00:00:00.000Z"),
}

describe("LandingAnalyticsRepository.summarize", () => {
  beforeEach(() => {
    groupBy.mockReset()
    groupBy.mockImplementation(async ({ by }: { by: string[] }) => {
      if (by[0] === "eventType") {
        return [
          { eventType: "landing.page_view", _count: { _all: 4 } },
          { eventType: "landing.cta_click", _count: { _all: 1 } },
        ]
      }
      if (by[0] === "visitorSessionId" && groupBy.mock.calls.length === 3) {
        return [
          { visitorSessionId: "session-1", _count: { _all: 3 } },
          { visitorSessionId: "session-2", _count: { _all: 1 } },
        ]
      }
      return [
        { visitorSessionId: "session-1", _count: { _all: 4 } },
        { visitorSessionId: "session-2", _count: { _all: 1 } },
        { visitorSessionId: "session-3", _count: { _all: 2 } },
      ]
    })
  })

  test("usa agregações distintas, janela semiaberta e retorna recorrentes por page view", async () => {
    const result = await new LandingAnalyticsRepository().summarize(input)

    expect(result).toEqual({
      totals: { "landing.page_view": 4, "landing.cta_click": 1 },
      uniqueVisitors: 2,
      returningVisitors: 1,
      byEventType: [
        { eventType: "landing.page_view", count: 4 },
        { eventType: "landing.cta_click", count: 1 },
      ],
    })
    expect(groupBy).toHaveBeenCalledTimes(3)
    for (const call of groupBy.mock.calls) {
      expect(call[0].where.occurredAt).toEqual({ gte: input.from, lt: input.to })
    }
    expect(groupBy.mock.calls[2][0].where.eventType).toBe("landing.page_view")
  })
})
