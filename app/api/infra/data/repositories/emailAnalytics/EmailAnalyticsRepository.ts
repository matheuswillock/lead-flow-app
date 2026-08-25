import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { resolveCampaignIdsIncludingSubs } from "@/lib/email/resolve-campaign-query-ids"
import { countUniqueFormMetricRecipients } from "@/lib/email/unique-form-metric-recipients"

export type EmailAnalyticsLogWhere = {
  teamId: string
  from: Date
  to: Date
  campaignId?: string
}

export type EmailAnalyticsDispatchRecord = {
  id: string
  dispatchNumber: number
  templateName: string
  templateVersionNumber: number
  templateSubject: string
  contactListName: string | null
  radarSegmentSlug: string | null
  dispatchedAt: Date
  totalRecipients: number
  totalSent: number
  totalDelivered: number
  totalOpened: number
  totalClicked: number
  totalBounced: number
  totalComplained: number
  status: string
}

export type EmailAnalyticsLogFilter =
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "delivery_delayed"
  | "unsubscribed"
  | "suppressed"

export type EmailTemplateVersionMetricRow = {
  versionGroupId: string
  templateId: string
  name: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
}

export type EmailCampaignMetricRow = {
  campaignId: string
  name: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
}

export type FormMetricEventType = "form_viewed" | "form_started" | "form_completed"

export type CountFormEventsOptions = {
  teamId: string
  from: Date
  to: Date
  eventType: "form_viewed" | "form_started"
  formId?: string
  campaignId?: string
}

/**
 * Funil de uma campanha, do envio ao lead, em uma consulta.
 *
 * Cada etapa de formulário conta **sessões únicas** — a tabela artesanal da
 * auditoria misturava unidades (contava `question_answered` em eventos brutos)
 * e é justamente o que esta SPEC corrige.
 */
export type EmailCampaignFunnel = {
  campaignId: string
  name: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  failed: number
  formViewed: number
  formStarted: number
  questionAnswered: number
  formCompleted: number
  leadAttached: number
}

export interface IEmailAnalyticsRepository {
  countLogs(where: EmailAnalyticsLogWhere, filter?: EmailAnalyticsLogFilter): Promise<number>
  findCampaignFunnel(options: {
    teamId: string
    campaignId: string
    from?: Date
    to?: Date
  }): Promise<EmailCampaignFunnel | null>
  listDispatches(options: {
    teamId: string
    campaignId: string
    from: Date
    to: Date
  }): Promise<EmailAnalyticsDispatchRecord[]>
  findDispatchPreview(options: {
    teamId: string
    campaignId: string
    dispatchId: string
  }): Promise<{
    templateSubject: string
    templateHtml: string
    templateVersionNumber: number
    templateName: string
  } | null>
  listTemplateVersionMetrics(options: {
    teamId: string
    from: Date
    to: Date
  }): Promise<EmailTemplateVersionMetricRow[]>
  listCampaignMetrics(options: {
    teamId: string
    from: Date
    to: Date
  }): Promise<EmailCampaignMetricRow[]>
  countFormEvents(options: CountFormEventsOptions): Promise<number>
  countFormCompletions(options: {
    teamId: string
    from: Date
    to: Date
    formId?: string
    campaignId?: string
  }): Promise<number>
  findCampaignTemplateHtml(options: {
    teamId: string
    campaignId: string
  }): Promise<string | null>
  findCampaignNames(options: {
    teamId: string
    campaignIds: string[]
  }): Promise<Array<{ id: string; name: string }>>
  findResendDomainTracking(teamId: string): Promise<{
    domainName: string | null
    domainStatus: string | null
    openTracking: boolean
    clickTracking: boolean
  }>
}

export class EmailAnalyticsRepository implements IEmailAnalyticsRepository {
  private async resolveCampaignFilter(teamId: string, campaignId?: string) {
    if (!campaignId) return undefined
    const campaignIds = await resolveCampaignIdsIncludingSubs(teamId, campaignId)
    return campaignIds.length === 1 ? campaignIds[0] : { in: campaignIds }
  }

  private async buildLogWhere(options: EmailAnalyticsLogWhere) {
    const campaignFilter = await this.resolveCampaignFilter(options.teamId, options.campaignId)
    return {
      teamId: options.teamId,
      sentAt: { gte: options.from, lte: options.to },
      ...(campaignFilter && { campaignId: campaignFilter }),
    }
  }

  async countLogs(
    where: EmailAnalyticsLogWhere,
    filter?: EmailAnalyticsLogFilter
  ): Promise<number> {
    const base = await this.buildLogWhere(where)
    const timestampFilter =
      filter === "delivered"
        ? { deliveredAt: { not: null as Date | null } }
        : filter === "opened"
          ? { openedAt: { not: null as Date | null } }
          : filter === "clicked"
            ? { clickedAt: { not: null as Date | null } }
            : filter === "bounced"
              ? { bouncedAt: { not: null as Date | null } }
              : filter === "complained"
                ? { complainedAt: { not: null as Date | null } }
                : filter === "failed"
                  ? { status: "failed" as const }
                  : filter === "suppressed"
                    ? { status: "suppressed" as const }
                    : filter === "delivery_delayed"
                      ? { events: { some: { type: "delivery_delayed" as const } } }
                      : filter === "unsubscribed"
                        ? { events: { some: { type: "unsubscribed" as const } } }
                        : {}

    return prisma.emailLog.count({
      where: { ...base, ...timestampFilter },
    })
  }

  /**
   * Uma consulta liga campanha → e-mail → formulário → lead.
   *
   * A ponte é o `cs_el`: o log de e-mail viaja no link e volta em
   * `origin.emailLogId` do evento de métrica. `origin.campaignId` entra como
   * segunda porta porque o enriquecimento do servidor carimba a campanha em
   * eventos cujo link perdeu o `cs_el`.
   *
   * Âncora do período: `createdAt` do log. `sentAt` deixaria de fora justamente
   * a campanha que morreu antes de enviar — a que mais precisa aparecer no funil.
   */
  async findCampaignFunnel(options: {
    teamId: string
    campaignId: string
    from?: Date
    to?: Date
  }): Promise<EmailCampaignFunnel | null> {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: options.campaignId, teamId: options.teamId },
      select: { id: true, name: true },
    })
    if (!campaign) return null

    const campaignIds = await resolveCampaignIdsIncludingSubs(
      options.teamId,
      options.campaignId,
    )

    const query = Prisma.sql`
      WITH logs AS (
        SELECT id, "sentAt", "deliveredAt", "openedAt", "clickedAt", status
        FROM "corretor_studio_email_logs"
        WHERE "teamId" = ${options.teamId}::uuid
          AND "campaignId" = ANY(${campaignIds}::uuid[])
          ${options.from ? Prisma.sql`AND "createdAt" >= ${options.from}` : Prisma.empty}
          ${options.to ? Prisma.sql`AND "createdAt" <= ${options.to}` : Prisma.empty}
      ),
      attributed AS (
        SELECT e."eventType", e."visitorSessionId"
        FROM "corretor_studio_public_form_metric_events" e
        WHERE
          -- Caminho principal, verificado no servidor: o log pertence ao time e
          -- a campanha, e ja esta recortado pelo periodo no CTE acima.
          e.origin->>'emailLogId' IN (SELECT id::text FROM logs)
          OR (
            -- Reserva, para o evento cujo link perdeu o cs_el. Ela precisa de
            -- tres amarras que faltavam:
            -- (a) so quando nao ha emailLogId utilizavel — senao o ramo
            --     principal ja decidiu, e este passaria por cima dele;
            -- (b) o mesmo periodo — origin.campaignId nao esta correlacionado
            --     com o CTE logs, entao sem isto o funil descrevia o recorte
            --     nos degraus de e-mail e a vida inteira da campanha nos de
            --     formulario, chegando a taxas acima de 100%;
            -- (c) o formulario tem de ser do time — origin vem do POST publico
            --     e sanitizePublicFormOrigin preserva qualquer campaignId com
            --     cara de UUID, entao sem esta amarra qualquer um que conheca
            --     o UUID de uma campanha injeta evento no funil dela.
            COALESCE(NULLIF(btrim(e.origin->>'emailLogId'), ''), NULL) IS NULL
            AND e.origin->>'campaignId' = ANY(${campaignIds}::text[])
            AND EXISTS (
              SELECT 1 FROM "corretor_studio_public_forms" f
              WHERE f.id = e."formId" AND f."teamId" = ${options.teamId}::uuid
            )
            ${options.from ? Prisma.sql`AND e."createdAt" >= ${options.from}` : Prisma.empty}
            ${options.to ? Prisma.sql`AND e."createdAt" <= ${options.to}` : Prisma.empty}
          )
      )
      SELECT
        (SELECT COUNT(*) FROM logs WHERE "sentAt" IS NOT NULL)::int AS "sent",
        (SELECT COUNT(*) FROM logs WHERE "deliveredAt" IS NOT NULL)::int AS "delivered",
        (SELECT COUNT(*) FROM logs WHERE "openedAt" IS NOT NULL)::int AS "opened",
        (SELECT COUNT(*) FROM logs WHERE "clickedAt" IS NOT NULL)::int AS "clicked",
        (SELECT COUNT(*) FROM logs WHERE status = 'failed'::"email_log_status")::int AS "failed",
        (SELECT COUNT(DISTINCT "visitorSessionId") FROM attributed
          WHERE "eventType" = 'form_viewed')::int AS "formViewed",
        (SELECT COUNT(DISTINCT "visitorSessionId") FROM attributed
          WHERE "eventType" = 'form_started')::int AS "formStarted",
        (SELECT COUNT(DISTINCT "visitorSessionId") FROM attributed
          WHERE "eventType" = 'question_answered')::int AS "questionAnswered",
        (SELECT COUNT(DISTINCT "visitorSessionId") FROM attributed
          WHERE "eventType" = 'form_completed')::int AS "formCompleted",
        (SELECT COUNT(DISTINCT "visitorSessionId") FROM attributed
          WHERE "eventType" IN ('lead_created', 'lead_attached'))::int AS "leadAttached"
    `

    const rows =
      await prisma.$queryRaw<Array<Omit<EmailCampaignFunnel, "campaignId" | "name">>>(query)
    const totals = rows[0]
    if (!totals) return null

    return { campaignId: campaign.id, name: campaign.name, ...totals }
  }

  async listDispatches(options: {
    teamId: string
    campaignId: string
    from: Date
    to: Date
  }) {
    const campaignFilter = await this.resolveCampaignFilter(options.teamId, options.campaignId)
    return prisma.emailCampaignDispatch.findMany({
      where: {
        teamId: options.teamId,
        ...(campaignFilter && { campaignId: campaignFilter }),
        dispatchedAt: { gte: options.from, lte: options.to },
      },
      select: {
        id: true,
        dispatchNumber: true,
        templateName: true,
        templateVersionNumber: true,
        templateSubject: true,
        contactListName: true,
        radarSegmentSlug: true,
        dispatchedAt: true,
        totalRecipients: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplained: true,
        status: true,
        errorMessage: true,
      },
      orderBy: { dispatchNumber: "desc" },
    })
  }

  async findDispatchPreview(options: {
    teamId: string
    campaignId: string
    dispatchId: string
  }) {
    const campaignFilter = await this.resolveCampaignFilter(options.teamId, options.campaignId)
    return prisma.emailCampaignDispatch.findFirst({
      where: {
        id: options.dispatchId,
        ...(campaignFilter && { campaignId: campaignFilter }),
        teamId: options.teamId,
      },
      select: {
        templateSubject: true,
        templateHtml: true,
        templateVersionNumber: true,
        templateName: true,
      },
    })
  }

  /**
   * Totais por versão de template (via disparos no período).
   * O UseCase agrega por versionGroupId e ranqueia.
   */
  async listTemplateVersionMetrics(options: {
    teamId: string
    from: Date
    to: Date
  }): Promise<EmailTemplateVersionMetricRow[]> {
    const dispatches = await prisma.emailCampaignDispatch.findMany({
      where: {
        teamId: options.teamId,
        dispatchedAt: { gte: options.from, lte: options.to },
      },
      select: {
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplained: true,
        templateId: true,
        templateName: true,
        template: {
          select: {
            versionGroupId: true,
            name: true,
          },
        },
      },
      orderBy: { dispatchedAt: "asc" },
    })

    return dispatches.map((dispatch) => ({
      versionGroupId: dispatch.template.versionGroupId,
      templateId: dispatch.templateId,
      name: dispatch.template.name || dispatch.templateName,
      sent: dispatch.totalSent,
      delivered: dispatch.totalDelivered,
      opened: dispatch.totalOpened,
      clicked: dispatch.totalClicked,
      bounced: dispatch.totalBounced,
      complained: dispatch.totalComplained,
    }))
  }

  /**
   * Totais por campanha (via disparos no período) para ranking do overview.
   */
  async listCampaignMetrics(options: {
    teamId: string
    from: Date
    to: Date
  }): Promise<EmailCampaignMetricRow[]> {
    const dispatches = await prisma.emailCampaignDispatch.findMany({
      where: {
        teamId: options.teamId,
        dispatchedAt: { gte: options.from, lte: options.to },
      },
      select: {
        campaignId: true,
        totalSent: true,
        totalDelivered: true,
        totalOpened: true,
        totalClicked: true,
        totalBounced: true,
        totalComplained: true,
        campaign: { select: { name: true } },
      },
    })

    return dispatches.map((dispatch) => ({
      campaignId: dispatch.campaignId,
      name: dispatch.campaign.name,
      sent: dispatch.totalSent,
      delivered: dispatch.totalDelivered,
      opened: dispatch.totalOpened,
      clicked: dispatch.totalClicked,
      bounced: dispatch.totalBounced,
      complained: dispatch.totalComplained,
    }))
  }

  private async buildFormMetricEventWhere(options: {
    teamId: string
    from: Date
    to: Date
    eventType: FormMetricEventType
    formId?: string
    campaignId?: string
  }) {
    const dateFilter = { createdAt: { gte: options.from, lte: options.to } }

    if (options.formId) {
      const campaignFilter = options.campaignId
        ? await this.buildCampaignOriginFilter(options.teamId, options.campaignId)
        : undefined

      return {
        formId: options.formId,
        eventType: options.eventType,
        ...dateFilter,
        form: { teamId: options.teamId },
        ...(campaignFilter && { OR: campaignFilter }),
      }
    }

    const forms = await prisma.publicForm.findMany({
      where: { teamId: options.teamId },
      select: { id: true },
    })
    if (forms.length === 0) return null

    const campaignFilter = options.campaignId
      ? await this.buildCampaignOriginFilter(options.teamId, options.campaignId)
      : undefined

    return {
      formId: { in: forms.map((form) => form.id) },
      eventType: options.eventType,
      ...dateFilter,
      ...(campaignFilter && { OR: campaignFilter }),
    }
  }

  private async buildCampaignOriginFilter(teamId: string, campaignId: string) {
    const campaignIds = await resolveCampaignIdsIncludingSubs(teamId, campaignId)
    return campaignIds.map((id) => ({
      origin: { path: ["campaignId"], equals: id },
    }))
  }

  async countFormEvents(options: CountFormEventsOptions): Promise<number> {
    const where = await this.buildFormMetricEventWhere(options)
    if (!where) return 0
    const rows = await prisma.publicFormMetricEvent.findMany({
      where,
      select: { visitorSessionId: true, origin: true },
    })
    return countUniqueFormMetricRecipients(rows)
  }

  async countFormCompletions(options: {
    teamId: string
    from: Date
    to: Date
    formId?: string
    campaignId?: string
  }): Promise<number> {
    const where = await this.buildFormMetricEventWhere({
      ...options,
      eventType: "form_completed",
    })
    if (!where) return 0
    const rows = await prisma.publicFormMetricEvent.findMany({
      where,
      select: { visitorSessionId: true, origin: true },
    })
    return countUniqueFormMetricRecipients(rows)
  }

  async findCampaignTemplateHtml(options: {
    teamId: string
    campaignId: string
  }): Promise<string | null> {
    const campaign = await prisma.emailCampaign.findFirst({
      where: { id: options.campaignId, teamId: options.teamId },
      select: {
        template: { select: { html: true } },
      },
    })
    return campaign?.template.html ?? null
  }

  async findCampaignNames(options: {
    teamId: string
    campaignIds: string[]
  }): Promise<Array<{ id: string; name: string }>> {
    if (options.campaignIds.length === 0) return []
    return prisma.emailCampaign.findMany({
      where: {
        teamId: options.teamId,
        id: { in: options.campaignIds },
      },
      select: { id: true, name: true },
    })
  }

  async findResendDomainTracking(teamId: string): Promise<{
    domainName: string | null
    domainStatus: string | null
    openTracking: boolean
    clickTracking: boolean
  }> {
    const settings = await prisma.emailTeamSettings.findUnique({
      where: { teamId },
      select: {
        resendDomainName: true,
        resendDomainStatus: true,
        resendOpenTracking: true,
        resendClickTracking: true,
      },
    })
    return {
      domainName: settings?.resendDomainName ?? null,
      domainStatus: settings?.resendDomainStatus ?? null,
      openTracking: Boolean(settings?.resendOpenTracking),
      clickTracking: Boolean(settings?.resendClickTracking),
    }
  }
}

export const emailAnalyticsRepository = new EmailAnalyticsRepository()
