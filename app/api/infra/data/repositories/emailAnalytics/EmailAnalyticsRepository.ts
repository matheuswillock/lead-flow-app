// Import de valor, não só de tipo: o E1 usa `Prisma.EmailLogWhereInput` (tipo) e
// o E4/E5 usam `Prisma.sql` (valor) no mesmo arquivo.
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { queryDispatchLogCounters } from "@/app/api/infra/data/repositories/emailLog/DispatchLogCountersQuery"
import { resolveCampaignIdsIncludingSubs } from "@/lib/email/resolve-campaign-query-ids"

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
  /**
   * Contadores de log do disparo. Os totais gravados no disparo só descrevem o
   * que saiu; sem estas três colunas um disparo que morreu por quota exibe
   * "delivered/opened" normais e nenhum sinal do incêndio.
   */
  failedCount: number
  suppressedCount: number
  queuedCount: number
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
  | "queued"

const LOG_FILTER_CONDITIONS: Record<EmailAnalyticsLogFilter, Prisma.EmailLogWhereInput> = {
  delivered: { deliveredAt: { not: null } },
  opened: { openedAt: { not: null } },
  clicked: { clickedAt: { not: null } },
  bounced: { bouncedAt: { not: null } },
  complained: { complainedAt: { not: null } },
  // `status` sozinho não delimita a população "nunca saiu". `applyWebhookEvent`
  // promove `email.failed` por prioridade de status e, para tipos sem timestamp
  // próprio, só escreve o status — `sentAt` e `resendEmailId` sobrevivem. Um log
  // aceito pelo Resend e marcado `failed` depois cairia em `sent` E em `failed`,
  // inflando `failureRate` e divergindo de `dispatches[].failedCount`. A regra é
  // a mesma de `queryDispatchLogCounters`, que é a fonte única da definição.
  failed: { status: "failed", sentAt: null, resendEmailId: null },
  suppressed: { status: "suppressed", sentAt: null, resendEmailId: null },
  queued: { status: "queued", sentAt: null, resendEmailId: null },
  delivery_delayed: { events: { some: { type: "delivery_delayed" } } },
  unsubscribed: { events: { some: { type: "unsubscribed" } } },
}

/**
 * Populações que nunca chegaram a sair: `sentAt` é NULL por construção. Ancorá-las
 * na âncora padrão do analytics (`sentAt`) as apagava de qualquer período — os
 * logs falhos eram invisíveis nos totais. `createdAt` é a única âncora que têm.
 */
const CREATED_AT_ANCHORED_FILTERS: ReadonlySet<EmailAnalyticsLogFilter> = new Set([
  "failed",
  "suppressed",
  "queued",
])

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

  private async buildLogWhere(
    options: EmailAnalyticsLogWhere,
    filter?: EmailAnalyticsLogFilter
  ): Promise<Prisma.EmailLogWhereInput> {
    const campaignFilter = await this.resolveCampaignFilter(options.teamId, options.campaignId)
    const period = { gte: options.from, lte: options.to }
    const anchor =
      filter && CREATED_AT_ANCHORED_FILTERS.has(filter)
        ? { createdAt: period }
        : { sentAt: period }

    return {
      teamId: options.teamId,
      ...anchor,
      ...(campaignFilter && { campaignId: campaignFilter }),
    }
  }

  async countLogs(
    where: EmailAnalyticsLogWhere,
    filter?: EmailAnalyticsLogFilter
  ): Promise<number> {
    const base = await this.buildLogWhere(where, filter)
    const condition = filter ? LOG_FILTER_CONDITIONS[filter] : {}

    return prisma.emailLog.count({
      where: { ...base, ...condition },
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
    const dispatches = await prisma.emailCampaignDispatch.findMany({
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

    const counters = await queryDispatchLogCounters(prisma, {
      teamId: options.teamId,
      dispatchIds: dispatches.map((dispatch) => dispatch.id),
    })
    const countersByDispatchId = new Map(counters.map((row) => [row.dispatchId, row]))

    return dispatches.map((dispatch) => {
      const counter = countersByDispatchId.get(dispatch.id)
      return {
        ...dispatch,
        failedCount: counter?.failedCount ?? 0,
        suppressedCount: counter?.suppressedCount ?? 0,
        queuedCount: counter?.queuedCount ?? 0,
      }
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

  /**
   * Destinatários únicos, contados no Postgres.
   *
   * Antes o método carregava todas as linhas do período e deduplicava em JS
   * (`Set` de chaves) — O(memória) num período que cresce sozinho. A chave é a
   * mesma de `uniqueFormMetricRecipientKey`: e-mail do destinatário, senão o
   * log da campanha, senão a sessão do visitante.
   */
  private async countUniqueFormMetricRecipientsInDatabase(options: {
    teamId: string
    from: Date
    to: Date
    eventType: FormMetricEventType
    formId?: string
    campaignId?: string
  }): Promise<number> {
    const formIds = await this.resolveFormIdsForCount(options.teamId, options.formId)
    if (formIds.length === 0) return 0

    const campaignIds = options.campaignId
      ? await resolveCampaignIdsIncludingSubs(options.teamId, options.campaignId)
      : null

    const query = Prisma.sql`
      SELECT COUNT(DISTINCT COALESCE(
        NULLIF('email:' || lower(btrim(origin->>'recipientEmail')), 'email:'),
        NULLIF('log:' || btrim(origin->>'emailLogId'), 'log:'),
        'session:' || "visitorSessionId"
      ))::int AS recipients
      FROM "corretor_studio_public_form_metric_events"
      WHERE "formId" = ANY(${formIds}::uuid[])
        AND "eventType" = ${options.eventType}::"PublicFormMetricType"
        AND "createdAt" >= ${options.from}
        AND "createdAt" <= ${options.to}
        ${
          campaignIds
            ? Prisma.sql`AND origin->>'campaignId' = ANY(${campaignIds}::text[])`
            : Prisma.empty
        }
    `

    const rows = await prisma.$queryRaw<Array<{ recipients: number | bigint }>>(query)
    return Number(rows[0]?.recipients ?? 0)
  }

  /**
   * Sem `formId` explícito o escopo é o time inteiro. A lista sai daqui para o
   * SQL poder filtrar por `formId = ANY(...)` sem um join só para o `teamId`.
   */
  private async resolveFormIdsForCount(teamId: string, formId?: string): Promise<string[]> {
    if (formId) {
      const form = await prisma.publicForm.findFirst({
        where: { id: formId, teamId },
        select: { id: true },
      })
      return form ? [form.id] : []
    }
    const forms = await prisma.publicForm.findMany({ where: { teamId }, select: { id: true } })
    return forms.map((form) => form.id)
  }

  async countFormEvents(options: CountFormEventsOptions): Promise<number> {
    return this.countUniqueFormMetricRecipientsInDatabase(options)
  }

  async countFormCompletions(options: {
    teamId: string
    from: Date
    to: Date
    formId?: string
    campaignId?: string
  }): Promise<number> {
    return this.countUniqueFormMetricRecipientsInDatabase({
      ...options,
      eventType: "form_completed",
    })
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
