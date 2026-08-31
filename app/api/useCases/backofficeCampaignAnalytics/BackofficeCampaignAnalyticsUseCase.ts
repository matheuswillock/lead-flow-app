import { Output } from "@/lib/output"
import { backofficeCampaignAnalyticsRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCampaignAnalytics/BackofficeCampaignAnalyticsRepository"
import type {
  DispatchPage,
  IBackofficeCampaignAnalyticsRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeCampaignAnalytics/IBackofficeCampaignAnalyticsRepository"
import { resolveCampaignAnalyticsDateRange } from "@/lib/backoffice-campaign-analytics/dateRange"
import { finalScore, openRate } from "@/lib/backoffice-campaign-analytics/metrics"

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

export type CampaignAnalyticsRangeInput = {
  from: string | null
  to: string | null
  teamIds: string[] | undefined
}

export type CampaignAnalyticsDispatchesInput = CampaignAnalyticsRangeInput & {
  page: number | undefined
  pageSize: number | undefined
}

function sumTemplateTotals(templates: { sent: number; delivered: number; opened: number; clicked: number; bounced: number; failed: number; dispatches: number }[]) {
  return templates.reduce(
    (acc, row) => ({
      dispatches: acc.dispatches + row.dispatches,
      sent: acc.sent + row.sent,
      delivered: acc.delivered + row.delivered,
      opened: acc.opened + row.opened,
      clicked: acc.clicked + row.clicked,
      bounced: acc.bounced + row.bounced,
      failed: acc.failed + row.failed,
    }),
    { dispatches: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, failed: 0 }
  )
}

export class BackofficeCampaignAnalyticsUseCase {
  constructor(
    private readonly repository: IBackofficeCampaignAnalyticsRepository = backofficeCampaignAnalyticsRepository
  ) {}

  async getSummary(input: CampaignAnalyticsRangeInput): Promise<Output> {
    const range = resolveCampaignAnalyticsDateRange({ from: input.from, to: input.to })
    if (!range.ok) return new Output(false, [], [range.error], null)

    try {
      const filter = { from: range.value.from, to: range.value.to, teamIds: input.teamIds }
      const [templates, leads, funnel] = await Promise.all([
        this.repository.aggregateByTemplate(filter),
        this.repository.leadsByOrigin(filter),
        this.repository.formFunnel(filter),
      ])

      const totals = sumTemplateTotals(templates)
      const leadsTotal = leads.reduce((sum, row) => sum + row.count, 0)
      const leadsCreated = funnel.reduce((sum, row) => sum + row.leadCreated, 0)
      const leadsAttached = funnel.reduce((sum, row) => sum + row.leadAttached, 0)

      const teamSentByTeamId = new Map<string, { teamId: string; teamName: string; sent: number; opened: number }>()
      for (const row of templates) {
        const existing = teamSentByTeamId.get(row.teamId) ?? {
          teamId: row.teamId,
          teamName: row.teamName,
          sent: 0,
          opened: 0,
        }
        existing.sent += row.sent
        existing.opened += row.opened
        teamSentByTeamId.set(row.teamId, existing)
      }

      const teamLeadsByTeamId = new Map<string, number>()
      for (const row of leads) {
        teamLeadsByTeamId.set(row.teamId, (teamLeadsByTeamId.get(row.teamId) ?? 0) + row.count)
      }

      const byTeam = [...teamSentByTeamId.values()].map((team) => {
        const teamLeads = teamLeadsByTeamId.get(team.teamId) ?? 0
        return {
          teamId: team.teamId,
          teamName: team.teamName,
          sent: team.sent,
          leads: teamLeads,
          finalScore: finalScore(teamLeads, team.sent),
          openRate: openRate(team.opened, team.sent),
        }
      })

      return new Output(true, [], [], {
        period: { from: range.value.from.toISOString(), to: range.value.to.toISOString() },
        totals: { ...totals, leadsCreated, leadsAttached, leadsTotal },
        rates: {
          openRate: openRate(totals.opened, totals.sent),
          finalScore: finalScore(leadsTotal, totals.sent),
        },
        byTeam,
      })
    } catch (error) {
      console.error("[BackofficeCampaignAnalyticsUseCase][getSummary]", error)
      return new Output(false, [], ["Erro ao carregar o resumo de campanhas"], null)
    }
  }

  async getDispatches(input: CampaignAnalyticsDispatchesInput): Promise<Output> {
    const range = resolveCampaignAnalyticsDateRange({ from: input.from, to: input.to })
    if (!range.ok) return new Output(false, [], [range.error], null)

    const page = input.page ?? 1
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE

    if (!Number.isInteger(page) || page < 1) {
      return new Output(false, [], ["\"page\" deve ser um inteiro maior ou igual a 1."], null)
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      return new Output(false, [], [`"pageSize" deve ser um inteiro entre 1 e ${MAX_PAGE_SIZE}.`], null)
    }

    try {
      const filter = { from: range.value.from, to: range.value.to, teamIds: input.teamIds }
      const result: DispatchPage = await this.repository.aggregateDispatches(filter, { page, pageSize })
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[BackofficeCampaignAnalyticsUseCase][getDispatches]", error)
      return new Output(false, [], ["Erro ao carregar os disparos"], null)
    }
  }

  async getTeamsSeries(input: CampaignAnalyticsRangeInput): Promise<Output> {
    const range = resolveCampaignAnalyticsDateRange({ from: input.from, to: input.to })
    if (!range.ok) return new Output(false, [], [range.error], null)

    try {
      const filter = { from: range.value.from, to: range.value.to, teamIds: input.teamIds }
      const points = await this.repository.dailySeries(filter)

      const totalByDay = new Map<string, { day: string; sent: number; delivered: number; opened: number; clicked: number }>()
      for (const point of points) {
        const existing = totalByDay.get(point.day) ?? { day: point.day, sent: 0, delivered: 0, opened: 0, clicked: 0 }
        existing.sent += point.sent
        existing.delivered += point.delivered
        existing.opened += point.opened
        existing.clicked += point.clicked
        totalByDay.set(point.day, existing)
      }

      const total = [...totalByDay.values()].sort((a, b) => a.day.localeCompare(b.day))

      return new Output(true, [], [], { granularity: "day", points, total })
    } catch (error) {
      console.error("[BackofficeCampaignAnalyticsUseCase][getTeamsSeries]", error)
      return new Output(false, [], ["Erro ao carregar a série de campanhas"], null)
    }
  }
}

export const backofficeCampaignAnalyticsUseCase = new BackofficeCampaignAnalyticsUseCase()
