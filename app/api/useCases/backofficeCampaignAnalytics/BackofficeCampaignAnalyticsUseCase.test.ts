import { describe, expect, it } from "bun:test"
import { BackofficeCampaignAnalyticsUseCase } from "./BackofficeCampaignAnalyticsUseCase"
import type {
  CampaignAnalyticsFilter,
  CampaignAnalyticsPagination,
  DailySeriesPoint,
  DispatchPage,
  FormFunnelRow,
  IBackofficeCampaignAnalyticsRepository,
  LeadsByOriginRow,
  TemplateAggregate,
} from "@/app/api/infra/data/repositories/backoffice/backofficeCampaignAnalytics/IBackofficeCampaignAnalyticsRepository"

class FakeRepository implements IBackofficeCampaignAnalyticsRepository {
  dispatchPage: DispatchPage = { rows: [], total: 0, page: 1, pageSize: 25 }
  templates: TemplateAggregate[] = []
  series: DailySeriesPoint[] = []
  funnel: FormFunnelRow[] = []
  leads: LeadsByOriginRow[] = []

  async aggregateDispatches(
    _filter: CampaignAnalyticsFilter,
    pagination: CampaignAnalyticsPagination
  ): Promise<DispatchPage> {
    return { ...this.dispatchPage, page: pagination.page, pageSize: pagination.pageSize }
  }

  async aggregateByTemplate(): Promise<TemplateAggregate[]> {
    return this.templates
  }

  async dailySeries(): Promise<DailySeriesPoint[]> {
    return this.series
  }

  async formFunnel(): Promise<FormFunnelRow[]> {
    return this.funnel
  }

  async leadsByOrigin(): Promise<LeadsByOriginRow[]> {
    return this.leads
  }
}

function buildUseCase(configure?: (repo: FakeRepository) => void) {
  const repo = new FakeRepository()
  configure?.(repo)
  return { useCase: new BackofficeCampaignAnalyticsUseCase(repo), repo }
}

const VALID_RANGE = { from: "2026-08-26", to: "2026-08-31" }

describe("BackofficeCampaignAnalyticsUseCase.getSummary", () => {
  it("T-10.5 — compõe totais, taxas e ranking por time a partir dos agregados do repository", async () => {
    const { useCase } = buildUseCase((repo) => {
      repo.templates = [
        { teamId: "t1", teamName: "Liber", templateName: "A", dispatches: 1, sent: 1623, delivered: 1400, opened: 459, clicked: 4, bounced: 10, failed: 0 },
        { teamId: "t2", teamName: "MultiSkill", templateName: "B", dispatches: 1, sent: 1402, delivered: 1300, opened: 275, clicked: 10, bounced: 5, failed: 0 },
      ]
      repo.leads = [
        { teamId: "t1", teamName: "Liber", originChannel: "email_campaign", count: 4 },
        { teamId: "t1", teamName: "Liber", originChannel: "public_form", count: 2 },
        { teamId: "t2", teamName: "MultiSkill", originChannel: "public_form", count: 5 },
      ]
      repo.funnel = [
        { formId: "f1", formName: "Form", teamId: "t1", teamName: "Liber", viewed: 67, started: 12, completed: 10, leadCreated: 1, leadAttached: 1 },
      ]
    })

    const output = await useCase.getSummary({ ...VALID_RANGE, teamIds: undefined })
    expect(output.isValid).toBe(true)

    const result = output.result as {
      totals: { sent: number; leadsTotal: number; leadsCreated: number; leadsAttached: number }
      byTeam: Array<{ teamId: string; leads: number; finalScore: number | null }>
    }
    expect(result.totals.sent).toBe(1623 + 1402)
    expect(result.totals.leadsTotal).toBe(11)
    expect(result.totals.leadsCreated).toBe(1)
    expect(result.totals.leadsAttached).toBe(1)

    const liber = result.byTeam.find((row) => row.teamId === "t1")
    expect(liber?.leads).toBe(6)
    expect(Math.round((liber?.finalScore ?? 0) * 100) / 100).toBe(3.7)
  })

  it("rejeita período acima de 92 dias com mensagem PT-BR clara (400)", async () => {
    const { useCase } = buildUseCase()
    const output = await useCase.getSummary({ from: "2026-05-01", to: "2026-08-31", teamIds: undefined })
    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain("92")
  })
})

describe("BackofficeCampaignAnalyticsUseCase.getDispatches", () => {
  it("aplica pageSize padrão e devolve a página do repository", async () => {
    const { useCase } = buildUseCase((repo) => {
      repo.dispatchPage = { rows: [], total: 3, page: 1, pageSize: 25 }
    })
    const output = await useCase.getDispatches({ ...VALID_RANGE, teamIds: undefined, page: undefined, pageSize: undefined })
    expect(output.isValid).toBe(true)
    expect((output.result as DispatchPage).total).toBe(3)
  })

  it("T-10.12 — rejeita pageSize acima de 100 (limite aplicado no use case, não só na rota)", async () => {
    const { useCase } = buildUseCase()
    const output = await useCase.getDispatches({ ...VALID_RANGE, teamIds: undefined, page: 1, pageSize: 500 })
    expect(output.isValid).toBe(false)
    expect(output.errorMessages.join(" ")).toContain("100")
  })

  it("rejeita page menor que 1", async () => {
    const { useCase } = buildUseCase()
    const output = await useCase.getDispatches({ ...VALID_RANGE, teamIds: undefined, page: 0, pageSize: 25 })
    expect(output.isValid).toBe(false)
  })
})

describe("BackofficeCampaignAnalyticsUseCase.getTeamsSeries", () => {
  it("soma a série total por dia a partir dos pontos por time", async () => {
    const { useCase } = buildUseCase((repo) => {
      repo.series = [
        { day: "2026-08-28", teamId: "t1", teamName: "Liber", sent: 100, delivered: 90, opened: 20, clicked: 1 },
        { day: "2026-08-28", teamId: "t2", teamName: "MultiSkill", sent: 50, delivered: 45, opened: 10, clicked: 0 },
      ]
    })
    const output = await useCase.getTeamsSeries({ ...VALID_RANGE, teamIds: undefined })
    expect(output.isValid).toBe(true)
    const result = output.result as {
      total: Array<{ day: string; sent: number; delivered: number; opened: number; clicked: number }>
    }
    expect(result.total).toEqual([{ day: "2026-08-28", sent: 150, delivered: 135, opened: 30, clicked: 1 }])
  })
})
