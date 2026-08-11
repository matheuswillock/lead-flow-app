import { describe, expect, it, mock } from "bun:test"
import { EmailAnalyticsUseCase } from "./EmailAnalyticsUseCase"
import type { IEmailAnalyticsRepository } from "@/app/api/infra/data/repositories/emailAnalytics/EmailAnalyticsRepository"

// EmailAnalyticsUseCase usa injeção por construtor — sem mock.module necessário

// ---------- helpers ----------

function buildRepo(overrides: Partial<IEmailAnalyticsRepository> = {}): IEmailAnalyticsRepository {
  return {
    countLogs: mock(async () => 0),
    listDispatches: mock(async () => []),
    findDispatchPreview: mock(async () => null),
    listTemplateVersionMetrics: mock(async () => []),
    listCampaignMetrics: mock(async () => []),
    countFormCompletions: mock(async () => 0),
    countFormEvents: mock(async () => 0),
    findCampaignTemplateHtml: mock(async () => null),
    findCampaignNames: mock(async () => []),
    findResendDomainStatus: mock(async () => null),
    ...overrides,
  } as IEmailAnalyticsRepository
}

const baseWindow = { from: new Date("2026-01-01"), to: new Date("2026-01-31") }

// ---------- testes ----------

describe("EmailAnalyticsUseCase.getAnalytics", () => {
  it("G0 — PeriodSlice expõe formViewed e formStarted no mesmo contrato de formCompletions", async () => {
    const countFormCompletions = mock(async () => 0)
    const countFormEvents = mock(async (_options: { eventType: string }) => {
      if (_options.eventType === "form_viewed") return 29
      if (_options.eventType === "form_started") return 6
      return 0
    })
    const repo = buildRepo({ countFormCompletions, countFormEvents })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(output.isValid).toBe(true)
    expect(output.result.totals.formViewed).toBe(29)
    expect(output.result.totals.formStarted).toBe(6)
    expect(output.result.totals.formCompletions).toBe(0)
    expect(output.result.deltas.totals.formViewed).toBeDefined()
    expect(output.result.deltas.totals.formStarted).toBeDefined()
    const eventTypes = countFormEvents.mock.calls.map(
      (call) => (call[0] as { eventType: string }).eventType,
    )
    expect(eventTypes).toContain("form_viewed")
    expect(eventTypes).toContain("form_started")
  })

  it("A1 — openRate usa 'sent' como denominador (não 'delivered')", async () => {
    const repo = buildRepo({
      countLogs: mock(async (_where, filter) => {
        if (!filter) return 2000
        if (filter === "delivered") return 1800
        if (filter === "opened") return 400
        if (filter === "clicked") return 100
        if (filter === "bounced") return 50
        if (filter === "complained") return 5
        return 0
      }),
    })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(output.isValid).toBe(true)
    // openRate correto: 400/2000 = 20.00
    expect(output.result.rates.openRate).toBe(20)
    // garante que o bug antigo (400/1800 ≈ 22.22) não está presente
    expect(output.result.rates.openRate).not.toBe(22.22)
    expect(output.result.deltas).toBeDefined()
    expect(output.result.totals.formCompletions).toBe(0)
  })

  it("A2 — clickRate usa 'sent' como denominador", async () => {
    const repo = buildRepo({
      countLogs: mock(async (_where, filter) => {
        if (!filter) return 2000
        if (filter === "delivered") return 1800
        if (filter === "opened") return 400
        if (filter === "clicked") return 100
        if (filter === "bounced") return 50
        if (filter === "complained") return 5
        return 0
      }),
    })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    // clickRate correto: 100/2000 = 5.00
    expect(output.result.rates.clickRate).toBe(5)
  })

  it("A3 — deliverabilityRate = delivered / sent", async () => {
    const repo = buildRepo({
      countLogs: mock(async (_where, filter) => {
        if (!filter) return 2000
        if (filter === "delivered") return 1800
        if (filter === "opened") return 400
        if (filter === "clicked") return 100
        if (filter === "bounced") return 50
        if (filter === "complained") return 5
        return 0
      }),
    })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(output.result.rates.deliverabilityRate).toBe(90) // 1800/2000
  })

  it("A4 — todos os rates são 0 quando sent=0 (sem divisão por zero)", async () => {
    const repo = buildRepo({ countLogs: mock(async () => 0) })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(output.isValid).toBe(true)
    expect(output.result.rates.openRate).toBe(0)
    expect(output.result.rates.clickRate).toBe(0)
    expect(output.result.rates.deliverabilityRate).toBe(0)
    expect(output.result.rates.bounceRate).toBe(0)
    expect(output.result.rates.complainRate).toBe(0)
  })

  it("A5 — safeRate arredonda para 2 casas decimais", async () => {
    // 1 opened / 3 sent = 33.33...
    const repo = buildRepo({
      countLogs: mock(async (_where, filter) => {
        if (!filter) return 3
        if (filter === "delivered") return 3
        if (filter === "opened") return 1
        return 0
      }),
    })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(output.result.rates.openRate).toBe(33.33)
  })

  it("A6 — sem campaignId: listDispatches NÃO é chamado", async () => {
    const listDispatches = mock(async () => [])
    const repo = buildRepo({ listDispatches })
    const uc = new EmailAnalyticsUseCase(repo)
    await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(listDispatches).not.toHaveBeenCalled()
  })

  it("A6b — expõe aviso quando domínio permite envio mas tracking não está pleno", async () => {
    const repo = buildRepo({
      findResendDomainStatus: mock(async () => "partially_verified"),
    })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(output.result.resendDomainTrackingCapable).toBe(false)
    expect(output.result.trackingWarnings).toHaveLength(1)
  })

  it("A7 — com campaignId: rates por disparo calculadas com 'sent' como denominador", async () => {
    const countLogs = mock(async (_where, filter) => {
      if (!filter) return 500
      if (filter === "delivered") return 450
      if (filter === "opened") return 200
      if (filter === "clicked") return 50
      if (filter === "bounced") return 10
      if (filter === "complained") return 2
      return 0
    })
    const listDispatches = mock(async () => [
      {
        id: "disp-1",
        dispatchNumber: 1,
        createdAt: new Date(),
        dispatchedAt: new Date(),
        totalRecipients: 100,
        totalSent: 100,
        totalDelivered: 90,
        totalOpened: 40,
        totalClicked: 10,
        totalBounced: 5,
        totalComplained: 1,
        status: "sent",
        templateName: "T",
        templateVersionNumber: 1,
        templateSubject: "S",
        contactListName: null,
        radarSegmentSlug: null,
      },
    ])
    const repo = buildRepo({ countLogs, listDispatches })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow, campaignId: "camp-1" })

    expect(output.isValid).toBe(true)
    expect(output.result.dispatches).toHaveLength(1)
    // openRate do disparo: 40/100 = 40
    expect(output.result.dispatches[0].rates.openRate).toBe(40)
    // deliverabilityRate do disparo: 90/100 = 90
    expect(output.result.dispatches[0].rates.deliverabilityRate).toBe(90)
  })

  it("A10 — repository lança exceção → isValid: false sem propagar", async () => {
    const repo = buildRepo({
      countLogs: mock(async () => {
        throw new Error("DB connection lost")
      }),
    })
    const uc = new EmailAnalyticsUseCase(repo)
    const output = await uc.getAnalytics({ teamId: "t1", ...baseWindow })

    expect(output.isValid).toBe(false)
    expect(output.errorMessages.length).toBeGreaterThan(0)
  })
})

describe("EmailAnalyticsUseCase.getDispatchPreview", () => {
  it("A8 — disparo não encontrado → isValid: false", async () => {
    const uc = new EmailAnalyticsUseCase(buildRepo({ findDispatchPreview: mock(async () => null) }))
    const output = await uc.getDispatchPreview({ teamId: "t1", campaignId: "c1", dispatchId: "d1" })

    expect(output.isValid).toBe(false)
  })

  it("A9 — disparo encontrado → retorna subject e html corretos", async () => {
    const preview = {
      templateSubject: "Assunto Campanha",
      templateHtml: "<p>Corpo</p>",
      templateVersionNumber: 3,
      templateName: "Template V3",
    }
    const uc = new EmailAnalyticsUseCase(
      buildRepo({ findDispatchPreview: mock(async () => preview) })
    )
    const output = await uc.getDispatchPreview({ teamId: "t1", campaignId: "c1", dispatchId: "d1" })

    expect(output.isValid).toBe(true)
    expect(output.result.subject).toBe("Assunto Campanha")
    expect(output.result.html).toBe("<p>Corpo</p>")
    expect(output.result.templateVersionNumber).toBe(3)
  })
})

describe("EmailAnalyticsUseCase.getTopTemplates", () => {
  it("D18 — agrega versões do mesmo grupo e ranqueia top 3", async () => {
    const listTemplateVersionMetrics = mock(async () => [
      {
        versionGroupId: "g1",
        templateId: "t1-v1",
        name: "Promo v1",
        sent: 100,
        delivered: 90,
        opened: 40,
        clicked: 5,
        bounced: 0,
        complained: 0,
      },
      {
        versionGroupId: "g1",
        templateId: "t1-v2",
        name: "Promo v2",
        sent: 100,
        delivered: 90,
        opened: 40,
        clicked: 5,
        bounced: 0,
        complained: 0,
      },
      {
        versionGroupId: "g2",
        templateId: "t2",
        name: "News",
        sent: 100,
        delivered: 95,
        opened: 10,
        clicked: 20,
        bounced: 0,
        complained: 0,
      },
      {
        versionGroupId: "g3",
        templateId: "t3",
        name: "Sem dados",
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
        bounced: 0,
        complained: 0,
      },
    ])
    const uc = new EmailAnalyticsUseCase(buildRepo({ listTemplateVersionMetrics }))
    const output = await uc.getTopTemplates({ teamId: "t1", ...baseWindow })

    expect(output.isValid).toBe(true)
    // g1 agrega 200 sent / 80 opened = 40% open — lidera abertura
    expect(output.result.byOpenRate[0].versionGroupId).toBe("g1")
    expect(output.result.byOpenRate[0].rates.openRate).toBe(40)
    // g2 lidera clique (20%)
    expect(output.result.byClickRate[0].versionGroupId).toBe("g2")
    // Sem dados suficientes fica de fora
    expect(
      output.result.byOpenRate.every((row: { versionGroupId: string }) => row.versionGroupId !== "g3"),
    ).toBe(true)
  })

  it("D18 — repository lança → isValid false", async () => {
    const uc = new EmailAnalyticsUseCase(
      buildRepo({
        listTemplateVersionMetrics: mock(async () => {
          throw new Error("db")
        }),
      }),
    )
    const output = await uc.getTopTemplates({ teamId: "t1", ...baseWindow })
    expect(output.isValid).toBe(false)
  })
})
