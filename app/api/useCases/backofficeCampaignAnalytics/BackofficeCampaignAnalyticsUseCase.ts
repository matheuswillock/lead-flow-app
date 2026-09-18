import { Output } from "@/lib/output"
import { backofficeCampaignAnalyticsRepository } from "@/app/api/infra/data/repositories/backoffice/backofficeCampaignAnalytics/BackofficeCampaignAnalyticsRepository"
import type {
  DailySeriesPoint,
  DispatchPage,
  DispatchRecord,
  FormFunnelRow,
  IBackofficeCampaignAnalyticsRepository,
  LeadsByOriginRow,
  TemplateAggregate,
} from "@/app/api/infra/data/repositories/backoffice/backofficeCampaignAnalytics/IBackofficeCampaignAnalyticsRepository"
import { backofficeCampaignAnalyticsExportAllService } from "@/app/api/services/backofficeCampaignAnalyticsExport/BackofficeCampaignAnalyticsExportAllService"
import type {
  CampaignAnalyticsExportAllSheet,
  IBackofficeCampaignAnalyticsExportAllService,
} from "@/app/api/services/backofficeCampaignAnalyticsExport/IBackofficeCampaignAnalyticsExportAllService"
import {
  resolveCampaignAnalyticsDateRange,
  resolveCampaignAnalyticsExportAllDateRange,
  type CampaignAnalyticsDateRange,
} from "@/lib/backoffice-campaign-analytics/dateRange"
import { finalScore, formCloseRate, openRate, startRate } from "@/lib/backoffice-campaign-analytics/metrics"
import {
  buildCampaignAnalyticsCsv,
  formatCsvDateTime,
  formatCsvInteger,
  formatCsvRate,
  formatCsvScore,
} from "@/lib/backoffice-campaign-analytics/csv"

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

function sumTemplateTotals(templates: { sent: number; delivered: number; opened: number; openedHuman: number; clicked: number; bounced: number; failed: number; dispatches: number }[]) {
  return templates.reduce(
    (acc, row) => ({
      dispatches: acc.dispatches + row.dispatches,
      sent: acc.sent + row.sent,
      delivered: acc.delivered + row.delivered,
      opened: acc.opened + row.opened,
      openedHuman: acc.openedHuman + row.openedHuman,
      clicked: acc.clicked + row.clicked,
      bounced: acc.bounced + row.bounced,
      failed: acc.failed + row.failed,
    }),
    { dispatches: 0, sent: 0, delivered: 0, opened: 0, openedHuman: 0, clicked: 0, bounced: 0, failed: 0 }
  )
}

export class BackofficeCampaignAnalyticsUseCase {
  constructor(
    private readonly repository: IBackofficeCampaignAnalyticsRepository = backofficeCampaignAnalyticsRepository,
    private readonly exportAllService: IBackofficeCampaignAnalyticsExportAllService = backofficeCampaignAnalyticsExportAllService
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

      return new Output(true, [], [], this.buildSummaryFromAggregates(range.value, templates, leads, funnel))
    } catch (error) {
      console.error("[BackofficeCampaignAnalyticsUseCase][getSummary]", error)
      return new Output(false, [], ["Erro ao carregar o resumo de campanhas"], null)
    }
  }

  async exportAll(input: CampaignAnalyticsRangeInput): Promise<Output> {
    const range = resolveCampaignAnalyticsExportAllDateRange({ from: input.from, to: input.to })
    if (!range.ok) return new Output(false, [], [range.error], null)

    try {
      const filter = { from: range.value.from, to: range.value.to, teamIds: input.teamIds }
      const [templates, leads, funnel, dispatchRows, points] = await Promise.all([
        this.repository.aggregateByTemplate(filter),
        this.repository.leadsByOrigin(filter),
        this.repository.formFunnel(filter),
        this.fetchAllDispatches(filter),
        this.repository.dailySeries(filter),
      ])

      const summary = this.buildSummaryFromAggregates(range.value, templates, leads, funnel)
      const filename = `campanhas_completo_${input.from}_${input.to}.xlsx`

      const { buffer } = this.exportAllService.buildWorkbook({
        filename,
        sheets: [
          this.summaryTable(input.from ?? "", input.to ?? "", summary),
          { name: "Disparos", ...this.dispatchesTable(dispatchRows) },
          { name: "Templates", ...this.templatesTable(this.toTemplateRows(templates)) },
          { name: "Formulários", ...this.formsTable(this.toFormFunnelRows(funnel)) },
          { name: "Série diária", ...this.seriesTable(points) },
        ],
      })

      return new Output(true, [], [], { buffer, filename })
    } catch (error) {
      if (error instanceof CampaignAnalyticsExportTooLargeError) {
        return new Output(false, [], [error.message], null)
      }
      console.error("[BackofficeCampaignAnalyticsUseCase][exportAll]", error)
      return new Output(false, [], ["Erro ao gerar o export completo"], null)
    }
  }

  private buildSummaryFromAggregates(
    range: CampaignAnalyticsDateRange,
    templates: TemplateAggregate[],
    leads: LeadsByOriginRow[],
    funnel: FormFunnelRow[]
  ) {
    const totals = sumTemplateTotals(templates)
    const leadsTotal = leads.reduce((sum, row) => sum + row.count, 0)
    const leadsCreated = funnel.reduce((sum, row) => sum + row.leadCreated, 0)
    const leadsAttached = funnel.reduce((sum, row) => sum + row.leadAttached, 0)

    const teamSentByTeamId = new Map<string, { teamId: string; teamName: string; sent: number; opened: number; openedHuman: number }>()
    for (const row of templates) {
      const existing = teamSentByTeamId.get(row.teamId) ?? {
        teamId: row.teamId,
        teamName: row.teamName,
        sent: 0,
        opened: 0,
        openedHuman: 0,
      }
      existing.sent += row.sent
      existing.opened += row.opened
      existing.openedHuman += row.openedHuman
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
        openRateHuman: openRate(team.openedHuman, team.sent),
      }
    })

    return {
      period: { from: range.from.toISOString(), to: range.to.toISOString() },
      totals: { ...totals, leadsCreated, leadsAttached, leadsTotal },
      rates: {
        // Headline "Aberturas reais": só opens humanos. O bruto segue exposto
        // como secundário — inclui robôs/proxies do provedor.
        openRateHuman: openRate(totals.openedHuman, totals.sent),
        openRate: openRate(totals.opened, totals.sent),
        finalScore: finalScore(leadsTotal, totals.sent),
      },
      byTeam,
    }
  }

  private summaryTable(
    from: string,
    to: string,
    summary: ReturnType<BackofficeCampaignAnalyticsUseCase["buildSummaryFromAggregates"]>
  ): CampaignAnalyticsExportAllSheet {
    return {
      name: "Resumo",
      headers: ["Métrica", "Valor"],
      rows: [
        ["Período (início)", from],
        ["Período (fim)", to],
        ["Disparos", formatCsvInteger(summary.totals.dispatches)],
        ["Falhas", formatCsvInteger(summary.totals.failed)],
        ["Enviados", formatCsvInteger(summary.totals.sent)],
        ["Entregues", formatCsvInteger(summary.totals.delivered)],
        ["Aberturas reais", formatCsvInteger(summary.totals.openedHuman)],
        ["Taxa de Aberturas reais", formatCsvRate(summary.rates.openRateHuman)],
        ["Taxa de Abertura (bruta)", formatCsvRate(summary.rates.openRate)],
        ["Cliques", formatCsvInteger(summary.totals.clicked)],
        ["Bounces", formatCsvInteger(summary.totals.bounced)],
        ["Nota Final", formatCsvScore(summary.rates.finalScore)],
        ["Leads Criados", formatCsvInteger(summary.totals.leadsCreated)],
        ["Leads Anexados", formatCsvInteger(summary.totals.leadsAttached)],
        ["Leads Totais", formatCsvInteger(summary.totals.leadsTotal)],
      ],
    }
  }

  private dispatchesTable(rows: DispatchRecord[]): { headers: string[]; rows: string[][] } {
    return {
      headers: ["Data", "Time", "Template", "Status", "Enviados", "Entregues", "Aberturas reais", "Abertos (bruto)", "Cliques", "Bounces", "Erro"],
      rows: rows.map((row) => [
        formatCsvDateTime(row.dispatchedAt),
        row.teamName,
        row.templateName,
        row.status,
        formatCsvInteger(row.totalSent),
        formatCsvInteger(row.totalDelivered),
        formatCsvInteger(row.totalOpenedHuman),
        formatCsvInteger(row.totalOpened),
        formatCsvInteger(row.totalClicked),
        formatCsvInteger(row.totalBounced),
        row.errorMessage ?? "",
      ]),
    }
  }

  private templatesTable(rows: ReturnType<BackofficeCampaignAnalyticsUseCase["toTemplateRows"]>): {
    headers: string[]
    rows: string[][]
  } {
    return {
      headers: ["Time", "Template", "Disparos", "Enviados", "Entregues", "Aberturas reais", "Abertos (bruto)", "Cliques", "Bounces", "Falhas", "Taxa de Abertura (bruta)"],
      rows: rows.map((row) => [
        row.teamName,
        row.templateName,
        formatCsvInteger(row.dispatches),
        formatCsvInteger(row.sent),
        formatCsvInteger(row.delivered),
        formatCsvInteger(row.openedHuman),
        formatCsvInteger(row.opened),
        formatCsvInteger(row.clicked),
        formatCsvInteger(row.bounced),
        formatCsvInteger(row.failed),
        formatCsvRate(row.openRate),
      ]),
    }
  }

  private formsTable(rows: ReturnType<BackofficeCampaignAnalyticsUseCase["toFormFunnelRows"]>): {
    headers: string[]
    rows: string[][]
  } {
    return {
      headers: ["Time", "Formulário", "Visualizações", "Inícios", "Conclusões", "Leads Criados", "Leads Anexados", "Taxa de Início", "Taxa de Fechamento"],
      rows: rows.map((row) => [
        row.teamName,
        row.formName,
        formatCsvInteger(row.viewed),
        formatCsvInteger(row.started),
        formatCsvInteger(row.completed),
        formatCsvInteger(row.leadCreated),
        formatCsvInteger(row.leadAttached),
        formatCsvRate(row.startRate),
        formatCsvRate(row.closeRate),
      ]),
    }
  }

  private seriesTable(points: DailySeriesPoint[]): { headers: string[]; rows: string[][] } {
    return {
      headers: ["Dia", "Time", "Enviados", "Entregues", "Aberturas reais", "Abertos (bruto)", "Cliques"],
      rows: points.map((row) => [
        row.day,
        row.teamName,
        formatCsvInteger(row.sent),
        formatCsvInteger(row.delivered),
        formatCsvInteger(row.openedHuman),
        formatCsvInteger(row.opened),
        formatCsvInteger(row.clicked),
      ]),
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

      const totalByDay = new Map<string, { day: string; sent: number; delivered: number; opened: number; openedHuman: number; clicked: number }>()
      for (const point of points) {
        const existing = totalByDay.get(point.day) ?? { day: point.day, sent: 0, delivered: 0, opened: 0, openedHuman: 0, clicked: 0 }
        existing.sent += point.sent
        existing.delivered += point.delivered
        existing.opened += point.opened
        existing.openedHuman += point.openedHuman
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

  private toTemplateRows(templates: TemplateAggregate[]) {
    const rows = templates.map((row) => ({ ...row, openRate: openRate(row.opened, row.sent) }))
    return sortByRateDesc(rows, (row) => row.openRate)
  }

  private async buildTemplateRows(filter: { from: Date; to: Date; teamIds: string[] | undefined }) {
    const templates = await this.repository.aggregateByTemplate(filter)
    return this.toTemplateRows(templates)
  }

  private toFormFunnelRows(funnel: FormFunnelRow[]) {
    const rows = funnel.map((row) => ({
      ...row,
      startRate: startRate(row.started, row.viewed),
      closeRate: formCloseRate(row.completed, row.started),
    }))
    return sortByRateDesc(rows, (row) => row.closeRate)
  }

  private async buildFormFunnelRows(filter: { from: Date; to: Date; teamIds: string[] | undefined }) {
    const funnel = await this.repository.formFunnel(filter)
    return this.toFormFunnelRows(funnel)
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
      const table = this.dispatchesTable(rows)
      return buildCampaignAnalyticsCsv(table.headers, table.rows)
    }

    if (dataset === "templates") {
      const rows = await this.buildTemplateRows(filter)
      const table = this.templatesTable(rows)
      return buildCampaignAnalyticsCsv(table.headers, table.rows)
    }

    if (dataset === "forms") {
      const rows = await this.buildFormFunnelRows(filter)
      const table = this.formsTable(rows)
      return buildCampaignAnalyticsCsv(table.headers, table.rows)
    }

    const points = await this.repository.dailySeries(filter)
    const table = this.seriesTable(points)
    return buildCampaignAnalyticsCsv(table.headers, table.rows)
  }

}

export const backofficeCampaignAnalyticsUseCase = new BackofficeCampaignAnalyticsUseCase()
