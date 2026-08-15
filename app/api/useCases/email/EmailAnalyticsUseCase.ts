import { Output } from "@/lib/output"
import {
  emailAnalyticsRepository,
  type IEmailAnalyticsRepository,
} from "@/app/api/infra/data/repositories/emailAnalytics/EmailAnalyticsRepository"
import { buildRates } from "@/lib/email/analytics-rates"
import {
  attachRateDeltas,
  attachTotalDeltas,
  previousPeriodRange,
  type AnalyticsTotalsForDelta,
} from "@/lib/email/analytics-deltas"
import {
  aggregateCampaignTotals,
  rankTopCampaigns,
} from "@/lib/email/campaign-ranking"
import {
  aggregateTemplateGroups,
  rankTopTemplates,
} from "@/lib/email/template-ranking"
import { detectLinkedFormFromTemplateHtml } from "@/lib/email/detect-template-form"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import {
  getResendDomainDispatchWarnings,
  isResendDomainTrackingCapable,
} from "@/lib/email/campaign-dispatch-guards"

type PeriodSlice = {
  period: { from: Date; to: Date }
  totals: AnalyticsTotalsForDelta
  rates: ReturnType<typeof buildRates>
}

export class EmailAnalyticsUseCase {
  constructor(private readonly repository: IEmailAnalyticsRepository = emailAnalyticsRepository) {}

  private async resolveFormIdForCampaign(
    teamId: string,
    campaignId: string,
  ): Promise<string | undefined> {
    const html = await this.repository.findCampaignTemplateHtml({ teamId, campaignId })
    const linked = await detectLinkedFormFromTemplateHtml(teamId, html)
    return linked?.id
  }

  private async loadPeriodTotals(options: {
    teamId: string
    from: Date
    to: Date
    campaignId?: string
    formId?: string | null
  }): Promise<PeriodSlice> {
    const logWhere = {
      teamId: options.teamId,
      from: options.from,
      to: options.to,
      campaignId: options.campaignId,
    }

    const formId =
      options.formId === null
        ? undefined
        : options.formId !== undefined
          ? options.formId
          : options.campaignId
            ? await this.resolveFormIdForCampaign(options.teamId, options.campaignId)
            : undefined

    // Visão geral (sem campaignId): conta todos os forms do time.
    // Por campanha sem form vinculado: formCompletions = 0 (formId explícito inexistente).
    const skipFormCount = options.campaignId !== undefined && formId === undefined && options.formId !== null

    const formCountOptions = skipFormCount
      ? null
      : {
          teamId: options.teamId,
          from: options.from,
          to: options.to,
          formId: options.campaignId ? formId : undefined,
          campaignId: options.campaignId,
        }

    const [
      total,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      failed,
      deliveryDelayed,
      unsubscribed,
      suppressed,
      formCompletions,
      formViewed,
      formStarted,
    ] = await Promise.all([
      this.repository.countLogs(logWhere),
      this.repository.countLogs(logWhere, "delivered"),
      this.repository.countLogs(logWhere, "opened"),
      this.repository.countLogs(logWhere, "clicked"),
      this.repository.countLogs(logWhere, "bounced"),
      this.repository.countLogs(logWhere, "complained"),
      this.repository.countLogs(logWhere, "failed"),
      this.repository.countLogs(logWhere, "delivery_delayed"),
      this.repository.countLogs(logWhere, "unsubscribed"),
      this.repository.countLogs(logWhere, "suppressed"),
      formCountOptions
        ? this.repository.countFormCompletions(formCountOptions)
        : Promise.resolve(0),
      formCountOptions
        ? this.repository.countFormEvents({ ...formCountOptions, eventType: "form_viewed" })
        : Promise.resolve(0),
      formCountOptions
        ? this.repository.countFormEvents({ ...formCountOptions, eventType: "form_started" })
        : Promise.resolve(0),
    ])

    const totals: AnalyticsTotalsForDelta = {
      sent: total,
      delivered,
      opened,
      clicked,
      bounced,
      complained,
      failed,
      deliveryDelayed,
      unsubscribed,
      suppressed,
      formCompletions,
      formViewed,
      formStarted,
    }

    return {
      period: { from: options.from, to: options.to },
      totals,
      rates: buildRates(totals),
    }
  }

  private withDeltas(current: PeriodSlice, previous: PeriodSlice) {
    return {
      period: current.period,
      totals: current.totals,
      rates: current.rates,
      previous: {
        period: previous.period,
        totals: previous.totals,
        rates: previous.rates,
      },
      deltas: {
        rates: attachRateDeltas(current.rates, previous.rates),
        totals: attachTotalDeltas(current.totals, previous.totals),
      },
    }
  }

  private async resolveTrackingMeta(teamId: string) {
    const snapshot = await this.repository.findResendDomainTracking(teamId)
    return {
      resendDomainTrackingCapable: isResendDomainTrackingCapable(snapshot.domainStatus),
      trackingWarnings: getResendDomainDispatchWarnings(snapshot),
    }
  }

  async getAnalytics(options: {
    teamId: string
    from: Date
    to: Date
    campaignId?: string
  }): Promise<Output> {
    try {
      const formId = options.campaignId
        ? await this.resolveFormIdForCampaign(options.teamId, options.campaignId)
        : undefined

      const prev = previousPeriodRange(options.from, options.to)

      const [current, previous, trackingMeta] = await Promise.all([
        this.loadPeriodTotals({
          teamId: options.teamId,
          from: options.from,
          to: options.to,
          campaignId: options.campaignId,
          formId: options.campaignId ? formId : undefined,
        }),
        this.loadPeriodTotals({
          teamId: options.teamId,
          from: prev.from,
          to: prev.to,
          campaignId: options.campaignId,
          formId: options.campaignId ? formId : undefined,
        }),
        this.resolveTrackingMeta(options.teamId),
      ])

      const base = { ...this.withDeltas(current, previous), ...trackingMeta }

      if (!options.campaignId) {
        return new Output(true, [], [], base)
      }

      const dispatches = await this.repository.listDispatches({
        teamId: options.teamId,
        campaignId: options.campaignId,
        from: options.from,
        to: options.to,
      })

      return new Output(true, [], [], {
        ...base,
        dispatches: dispatches.map((dispatch) => ({
          ...dispatch,
          rates: buildRates({
            sent: dispatch.totalSent,
            delivered: dispatch.totalDelivered,
            opened: dispatch.totalOpened,
            clicked: dispatch.totalClicked,
            bounced: dispatch.totalBounced,
            complained: dispatch.totalComplained,
          }),
        })),
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getAnalytics]", error)
      return new Output(false, [], ["Erro ao carregar analytics"], null)
    }
  }

  async getOverview(options: {
    teamId: string
    timezone: string
  }): Promise<Output> {
    try {
      const now = new Date()
      const todayStart = startOfDayInTz(now, options.timezone)
      const tomorrowStart = startOfDayInTz(addDaysInTz(todayStart, 1, options.timezone), options.timezone)
      const yesterdayStart = startOfDayInTz(addDaysInTz(todayStart, -1, options.timezone), options.timezone)

      const [current, previous, campaignRows, trackingMeta] = await Promise.all([
        this.loadPeriodTotals({
          teamId: options.teamId,
          from: todayStart,
          to: tomorrowStart,
        }),
        this.loadPeriodTotals({
          teamId: options.teamId,
          from: yesterdayStart,
          to: todayStart,
        }),
        this.repository.listCampaignMetrics({
          teamId: options.teamId,
          from: todayStart,
          to: tomorrowStart,
        }),
        this.resolveTrackingMeta(options.teamId),
      ])

      const topCampaigns = rankTopCampaigns(aggregateCampaignTotals(campaignRows), 3)

      return new Output(true, [], [], {
        ...this.withDeltas(current, previous),
        ...trackingMeta,
        topCampaigns,
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getOverview]", error)
      return new Output(false, [], ["Erro ao carregar overview de campanhas"], null)
    }
  }

  async compareCampaigns(options: {
    teamId: string
    from: Date
    to: Date
    campaignIds: string[]
  }): Promise<Output> {
    try {
      const uniqueIds = Array.from(new Set(options.campaignIds.filter(Boolean)))
      if (uniqueIds.length === 0 || uniqueIds.length > 3) {
        return new Output(false, [], ["Informe entre 1 e 3 campanhas para comparar"], null)
      }

      const names = await this.repository.findCampaignNames({
        teamId: options.teamId,
        campaignIds: uniqueIds,
      })
      const nameById = new Map(names.map((row) => [row.id, row.name]))

      const missing = uniqueIds.filter((id) => !nameById.has(id))
      if (missing.length > 0) {
        return new Output(false, [], ["Uma ou mais campanhas não foram encontradas"], null)
      }

      const prev = previousPeriodRange(options.from, options.to)
      const trackingMeta = await this.resolveTrackingMeta(options.teamId)

      const campaigns = await Promise.all(
        uniqueIds.map(async (campaignId) => {
          const formId = await this.resolveFormIdForCampaign(options.teamId, campaignId)
          const [current, previous] = await Promise.all([
            this.loadPeriodTotals({
              teamId: options.teamId,
              from: options.from,
              to: options.to,
              campaignId,
              formId,
            }),
            this.loadPeriodTotals({
              teamId: options.teamId,
              from: prev.from,
              to: prev.to,
              campaignId,
              formId,
            }),
          ])

          return {
            campaignId,
            name: nameById.get(campaignId) ?? campaignId,
            ...this.withDeltas(current, previous),
          }
        }),
      )

      return new Output(true, [], [], {
        period: { from: options.from, to: options.to },
        previousPeriod: prev,
        ...trackingMeta,
        campaigns,
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][compareCampaigns]", error)
      return new Output(false, [], ["Erro ao comparar campanhas"], null)
    }
  }

  async getDispatchPreview(options: {
    teamId: string
    campaignId: string
    dispatchId: string
  }): Promise<Output> {
    try {
      const dispatch = await this.repository.findDispatchPreview(options)

      if (!dispatch) {
        return new Output(false, [], ["Disparo não encontrado"], null)
      }

      return new Output(true, [], [], {
        subject: dispatch.templateSubject,
        html: dispatch.templateHtml,
        templateVersionNumber: dispatch.templateVersionNumber,
        templateName: dispatch.templateName,
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getDispatchPreview]", error)
      return new Output(false, [], ["Erro ao carregar prévia do disparo"], null)
    }
  }

  async getTopTemplates(options: {
    teamId: string
    from: Date
    to: Date
  }): Promise<Output> {
    try {
      const rows = await this.repository.listTemplateVersionMetrics(options)
      const ranking = rankTopTemplates(aggregateTemplateGroups(rows))

      return new Output(true, [], [], {
        period: { from: options.from, to: options.to },
        ...ranking,
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getTopTemplates]", error)
      return new Output(false, [], ["Erro ao carregar ranking de templates"], null)
    }
  }
}

export const emailAnalyticsUseCase = new EmailAnalyticsUseCase()
