import { Output } from "@/lib/output"
import { backofficeCampaignAnalyticsRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCampaignAnalytics/BackofficeCampaignAnalyticsRepository"
import type {
  DispatchPage,
  IBackofficeCampaignAnalyticsRepository,
} from "@/app/api/infra/data/repositories/backoffice/backofficeCampaignAnalytics/IBackofficeCampaignAnalyticsRepository"
import { resolveCampaignAnalyticsDateRange } from "@/lib/backoffice-campaign-analytics/dateRange"
import { finalScore, formCloseRate, openRate, startRate } from "@/lib/backoffice-campaign-analytics/metrics"
import { buildCampaignAnalyticsCsv, formatCsvDateTime, formatCsvInteger, formatCsvRate } from "@/lib/backoffice-campaign-analytics/csv"

// Ordena desc pela taxa; null (divisor zero) sempre por último — nunca tratado como 0.
function sortByRateDesc<T>(rows: T[], getRate: (row: T) => number | null): T[] {
  return [...rows].sort((a, b) => {
    const rateA = getRate(a)
    const rateB = getRate(b)
    if (rateA === null && rateB === null) return 0
    if (rateA === null) return 1
    if (rateB === null) return -1
    return rateB - rateA
  })
}

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

export const CAMPAIGN_ANALYTICS_CSV_DATASETS = ["dispatches", "templates", "forms", "series"] as const
export type CampaignAnalyticsCsvDataset = (typeof CAMPAIGN_ANALYTICS_CSV_DATASETS)[number]

export type CampaignAnalyticsExportCsvInput = CampaignAnalyticsRangeInput & {
  dataset: string
}

// Todo dispatch do período cabe numa exportação — evita fatiar em páginas de 100
// só para depois remontar o CSV. Acima do limite de segurança o export FALHA
// explicitamente (400) em vez de devolver um CSV truncado que parece completo
// (review #1111 — silêncio aqui seria um dado incompleto disfarçado de sucesso).
const CSV_DISPATCH_ROW_SAFETY_LIMIT = 20_000

class CampaignAnalyticsExportTooLargeError extends Error {
  constructor(public readonly total: number) {
    super(
      `O período selecionado tem ${total} disparos, acima do limite de ${CSV_DISPATCH_ROW_SAFETY_LIMIT} linhas por export — reduza o período ou os times filtrados.`
    )
  }
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

  async getTemplates(input: CampaignAnalyticsRangeInput): Promise<Output> {
    const range = resolveCampaignAnalyticsDateRange({ from: input.from, to: input.to })
    if (!range.ok) return new Output(false, [], [range.error], null)

    try {
      const filter = { from: range.value.from, to: range.value.to, teamIds: input.teamIds }
      return new Output(true, [], [], await this.buildTemplateRows(filter))
    } catch (error) {
      console.error("[BackofficeCampaignAnalyticsUseCase][getTemplates]", error)
      return new Output(false, [], ["Erro ao carregar os templates"], null)
    }
  }

  async getFormsFunnel(input: CampaignAnalyticsRangeInput): Promise<Output> {
    const range = resolveCampaignAnalyticsDateRange({ from: input.from, to: input.to })
    if (!range.ok) return new Output(false, [], [range.error], null)

    try {
      const filter = { from: range.value.from, to: range.value.to, teamIds: input.teamIds }
      return new Output(true, [], [], await this.buildFormFunnelRows(filter))
    } catch (error) {
      console.error("[BackofficeCampaignAnalyticsUseCase][getFormsFunnel]", error)
      return new Output(false, [], ["Erro ao carregar o funil de formulários"], null)
    }
  }

  async exportCsv(input: CampaignAnalyticsExportCsvInput): Promise<Output> {
    if (!(CAMPAIGN_ANALYTICS_CSV_DATASETS as readonly string[]).includes(input.dataset)) {
      return new Output(
        false,
        [],
        [`"dataset" inválido — use um de: ${CAMPAIGN_ANALYTICS_CSV_DATASETS.join(", ")}.`],
        null
      )
    }
    const dataset = input.dataset as CampaignAnalyticsCsvDataset

    const range = resolveCampaignAnalyticsDateRange({ from: input.from, to: input.to })
    if (!range.ok) return new Output(false, [], [range.error], null)

    try {
      const filter = { from: range.value.from, to: range.value.to, teamIds: input.teamIds }
      const csv = await this.buildCsvForDataset(dataset, filter)
      const filename = `campanhas_${dataset}_${input.from}_${input.to}.csv`
      return new Output(true, [], [], { csv, filename })
    } catch (error) {
      if (error instanceof CampaignAnalyticsExportTooLargeError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[BackofficeCampaignAnalyticsUseCase][exportCsv]", error)
      return new Output(false, [], ["Erro ao gerar o export CSV"], null)
    }
  }

  private async buildTemplateRows(filter: { from: Date; to: Date; teamIds: string[] | undefined }) {
    const templates = await this.repository.aggregateByTemplate(filter)
    const rows = templates.map((row) => ({ ...row, openRate: openRate(row.opened, row.sent) }))
    return sortByRateDesc(rows, (row) => row.openRate)
  }

  private async buildFormFunnelRows(filter: { from: Date; to: Date; teamIds: string[] | undefined }) {
    const funnel = await this.repository.formFunnel(filter)
    const rows = funnel.map((row) => ({
      ...row,
      startRate: startRate(row.started, row.viewed),
      closeRate: formCloseRate(row.completed, row.started),
    }))
    return sortByRateDesc(rows, (row) => row.closeRate)
  }

  private async fetchAllDispatches(filter: { from: Date; to: Date; teamIds: string[] | undefined }) {
    const rows: Awaited<ReturnType<IBackofficeCampaignAnalyticsRepository["aggregateDispatches"]>>["rows"] = []
    let page = 1
    while (true) {
      const result = await this.repository.aggregateDispatches(filter, { page, pageSize: MAX_PAGE_SIZE })
      rows.push(...result.rows)
      if (rows.length >= result.total) break
      if (rows.length >= CSV_DISPATCH_ROW_SAFETY_LIMIT) throw new CampaignAnalyticsExportTooLargeError(result.total)
      if (result.rows.length < MAX_PAGE_SIZE) break // proteção contra total inconsistente/loop infinito
      page++
    }
    return rows
  }

  private async buildCsvForDataset(
    dataset: CampaignAnalyticsCsvDataset,
    filter: { from: Date; to: Date; teamIds: string[] | undefined }
  ): Promise<string> {
    if (dataset === "dispatches") {
      const rows = await this.fetchAllDispatches(filter)
      return buildCampaignAnalyticsCsv(
        ["Data", "Time", "Template", "Status", "Enviados", "Entregues", "Abertos", "Cliques", "Bounces", "Erro"],
        rows.map((row) => [
          formatCsvDateTime(row.dispatchedAt),
          row.teamName,
          row.templateName,
          row.status,
          formatCsvInteger(row.totalSent),
          formatCsvInteger(row.totalDelivered),
          formatCsvInteger(row.totalOpened),
          formatCsvInteger(row.totalClicked),
          formatCsvInteger(row.totalBounced),
          row.errorMessage ?? "",
        ])
      )
    }

    if (dataset === "templates") {
      const rows = await this.buildTemplateRows(filter)
      return buildCampaignAnalyticsCsv(
        ["Time", "Template", "Disparos", "Enviados", "Entregues", "Abertos", "Cliques", "Bounces", "Falhas", "Taxa de Abertura"],
        rows.map((row) => [
          row.teamName,
          row.templateName,
          formatCsvInteger(row.dispatches),
          formatCsvInteger(row.sent),
          formatCsvInteger(row.delivered),
          formatCsvInteger(row.opened),
          formatCsvInteger(row.clicked),
          formatCsvInteger(row.bounced),
          formatCsvInteger(row.failed),
          formatCsvRate(row.openRate),
        ])
      )
    }

    if (dataset === "forms") {
      const rows = await this.buildFormFunnelRows(filter)
      return buildCampaignAnalyticsCsv(
        ["Time", "Formulário", "Visualizações", "Inícios", "Conclusões", "Leads Criados", "Leads Anexados", "Taxa de Início", "Taxa de Fechamento"],
        rows.map((row) => [
          row.teamName,
          row.formName,
          formatCsvInteger(row.viewed),
          formatCsvInteger(row.started),
          formatCsvInteger(row.completed),
          formatCsvInteger(row.leadCreated),
          formatCsvInteger(row.leadAttached),
          formatCsvRate(row.startRate),
          formatCsvRate(row.closeRate),
        ])
      )
    }

    const points = await this.repository.dailySeries(filter)
    return buildCampaignAnalyticsCsv(
      ["Dia", "Time", "Enviados", "Entregues", "Abertos", "Cliques"],
      points.map((row) => [
        row.day,
        row.teamName,
        formatCsvInteger(row.sent),
        formatCsvInteger(row.delivered),
        formatCsvInteger(row.opened),
        formatCsvInteger(row.clicked),
      ])
    )
  }
}

export const backofficeCampaignAnalyticsUseCase = new BackofficeCampaignAnalyticsUseCase()
