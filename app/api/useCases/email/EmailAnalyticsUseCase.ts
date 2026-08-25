import { Output } from "@/lib/output"
import {
  emailAnalyticsRepository,
  type EmailAnalyticsLogWhere,
  type IEmailAnalyticsRepository,
} from "@/app/api/infra/data/repositories/emailAnalytics/EmailAnalyticsRepository"
import { buildCampaignFunnelRates, buildRates } from "@/lib/email/analytics-rates"
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
  assertResendDomainTrackingReady,
  getResendDomainDispatchWarnings,
  isResendDomainTrackingCapable,
} from "@/lib/email/campaign-dispatch-guards"

/**
 * Distingue "campanha não existe" de "a consulta explodiu".
 *
 * O contrato `Output` colapsa as duas em `isValid: false`, e a rota mapeava tudo
 * para 404 — uma falha de banco respondia "campanha não encontrada" e o handler
 * de 500 nunca era alcançado. A rota compara com esta constante para separar.
 */
export const CAMPAIGN_FUNNEL_NOT_FOUND_MESSAGE = "Campanha não encontrada"

/**
 * Relógio declarado na resposta (D5 — Proposta A).
 *
 * `event` significa que cada métrica conta no timestamp do próprio fato:
 * "aberturas OCORRIDAS no período", não "aberturas dos e-mails enviados no
 * período". O campo existe para que nenhum número saia da API sem dizer de que
 * relógio veio — foi essa ambiguidade que deixou três âncoras conviverem na
 * mesma tela (auditoria M2/H7).
 *
 * `cohort` fica reservado: se um dia alguma resposta voltar a ancorar tudo em
 * `sentAt`, ela declara isso em vez de parecer a mesma coisa.
 */
export type AnalyticsAnchor =
  /** Cada métrica no timestamp do próprio fato — "aberturas ocorridas no período". */
  | "event"
  /**
   * Coorte de disparo: a janela seleciona os DISPAROS, e os números são os
   * contadores acumulados deles — que incluem abertura e clique ocorridos fora
   * da janela. Não é fato-no-tempo, e dizer que é seria a mentira de relógio que
   * a D5 existe para matar.
   */
  | "dispatch_dispatched_at"
  /** Funil de campanha: a janela recorta o nascimento do log. */
  | "log_created_at"

/** Âncora das respostas que contam fato no próprio tempo (D5 — Proposta A). */
export const ANALYTICS_ANCHOR: AnalyticsAnchor = "event"

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
      queued,
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
      this.repository.countLogs(logWhere, "queued"),
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
      queued,
      formCompletions,
      formViewed,
      formStarted,
    }

    // As taxas NÃO saem dos `totals`.
    //
    // Sob a âncora de evento, `opened` e `delivered` contam populações
    // diferentes — aberturas ocorridas na janela versus entregas ocorridas na
    // janela. A razão entre elas não é conversão: numa janela curta com
    // aberturas de e-mails antigos, passa de 100%. A coorte põe numerador e
    // denominador no mesmo conjunto ("dos entregues na janela, quantos
    // abriram"), e a resposta declara isso em `rateBasis`.
    const cohort = await this.loadCohortTotals(logWhere, totals)

    return {
      period: { from: options.from, to: options.to },
      totals,
      rates: buildRates(cohort),
    }
  }

  /**
   * Contagens de coorte para as taxas. `sent` e `failed` são os mesmos dos
   * totais — a coorte de envio da janela É a população contada por `sentAt`.
   */
  private async loadCohortTotals(
    logWhere: EmailAnalyticsLogWhere,
    totals: AnalyticsTotalsForDelta,
  ) {
    const [delivered, opened, openedOnSent, clicked, bounced, complained] = await Promise.all([
      this.repository.countCohortLogs(logWhere, "delivered"),
      this.repository.countCohortLogs(logWhere, "opened"),
      this.repository.countCohortLogs(logWhere, "openedOnSent"),
      this.repository.countCohortLogs(logWhere, "clicked"),
      this.repository.countCohortLogs(logWhere, "bounced"),
      this.repository.countCohortLogs(logWhere, "complained"),
    ])

    return {
      sent: totals.sent,
      failed: totals.failed,
      // Denominador do openRate (D6): a coorte de ENTREGAS da janela.
      deliveredCohort: totals.delivered,
      delivered,
      opened,
      openedOnSent,
      clicked,
      bounced,
      complained,
    }
  }

  private withDeltas(current: PeriodSlice, previous: PeriodSlice) {
    return {
      period: current.period,
      // Todo recorte de período sai daqui, então é aqui que o relógio é
      // declarado: nenhuma resposta com `period` chega ao frontend sem `anchor`.
      anchor: ANALYTICS_ANCHOR,
      /**
       * `rates` NÃO deriva de `totals` — e isso precisa ser dito, senão alguém
       * recalcula `opened/delivered` na tela, acha outro número e reporta como
       * bug. `totals` conta fato-no-tempo; `rates` mede coorte.
       */
      rateBasis: "cohort" as const,
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
      // O alerta da tela precisa saber se o gate travou de verdade. Deduzir isso
      // de "existe aviso" ficou errado quando aviso deixou de implicar bloqueio.
      trackingDispatchBlocked: !assertResendDomainTrackingReady(snapshot).ok,
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
            failed: dispatch.failedCount,
          }),
        })),
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getAnalytics]", error)
      return new Output(false, [], ["Erro ao carregar analytics"], null)
    }
  }

  /**
   * Funil campanha → lead. Sai das queries artesanais da auditoria e vira
   * contrato do produto: cada etapa de formulário em sessões únicas, com o
   * denominador de cada salto explícito na resposta.
   */
  async getCampaignFunnel(options: {
    teamId: string
    campaignId: string
    from?: Date
    to?: Date
  }): Promise<Output> {
    try {
      const funnel = await this.repository.findCampaignFunnel(options)
      if (!funnel) {
        return new Output(false, [], [CAMPAIGN_FUNNEL_NOT_FOUND_MESSAGE], null)
      }

      return new Output(true, [], [], {
        period: { from: options.from ?? null, to: options.to ?? null },
        /** Toda etapa de formulário conta sessão única, nunca evento bruto. */
        unit: "unique_sessions" as const,
        /** Relógio do período: `createdAt` do log, para a campanha que falhou antes de enviar não sumir. */
        anchor: "log_created_at" as const,
        ...funnel,
        rates: buildCampaignFunnelRates(funnel),
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getCampaignFunnel]", error)
      return new Output(false, [], ["Erro ao carregar funil da campanha"], null)
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
        anchor: ANALYTICS_ANCHOR,
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
        // Coorte, não fato-no-tempo: `listTemplateVersionMetrics` filtra os
        // DISPAROS por `dispatchedAt` e soma os contadores acumulados deles,
        // que incluem abertura e clique ocorridos depois da janela. Rotular
        // isso como `event` diria ao consumidor que os números aconteceram no
        // período — exatamente a mentira de relógio que a D5 mata.
        anchor: "dispatch_dispatched_at" as const,
        ...ranking,
      })
    } catch (error) {
      console.error("[EmailAnalyticsUseCase][getTopTemplates]", error)
      return new Output(false, [], ["Erro ao carregar ranking de templates"], null)
    }
  }
}

export const emailAnalyticsUseCase = new EmailAnalyticsUseCase()
