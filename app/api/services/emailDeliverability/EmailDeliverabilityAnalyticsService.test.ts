import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))
import { buildDeliverabilityDashboard } from "./EmailDeliverabilityAnalyticsService"

describe("buildDeliverabilityDashboard", () => {
  it("agrega métricas por domínio, provedor e dia sem perder supressões", () => {
    const dashboard = buildDeliverabilityDashboard([
      {
        metricDate: new Date("2026-09-20T00:00:00.000Z"),
        senderDomain: "imobiliaria.example",
        recipientProvider: "gmail",
        sent: 100,
        delivered: 94,
        hardBounced: 2,
        softBounced: 3,
        complained: 1,
        humanOpened: 40,
        clicked: 12,
        suppressed: 4,
      },
      {
        metricDate: new Date("2026-09-20T00:00:00.000Z"),
        senderDomain: "imobiliaria.example",
        recipientProvider: "microsoft",
        sent: 50,
        delivered: 49,
        hardBounced: 1,
        softBounced: 0,
        complained: 0,
        humanOpened: 20,
        clicked: 8,
        suppressed: 2,
      },
    ])

    expect(dashboard.summary).toMatchObject({
      sent: 150,
      delivered: 143,
      hardBounced: 3,
      softBounced: 3,
      complained: 1,
      suppressed: 6,
      deliveryRate: 143 / 150,
      bounceRate: 6 / 150,
    })
    expect(dashboard.series).toHaveLength(1)
    expect(dashboard.domains).toHaveLength(1)
    expect(dashboard.providers.map((row) => row.recipientProvider)).toEqual([
      "gmail",
      "microsoft",
    ])
  })
})
