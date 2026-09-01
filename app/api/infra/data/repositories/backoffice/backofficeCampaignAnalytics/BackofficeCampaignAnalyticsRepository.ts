import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { notFabricatedByDispatcherSql, periodAnchorSql } from "@/app/api/infra/data/repositories/publicForms/MetricEventAggregationSql"
import type {
  CampaignAnalyticsFilter,
  CampaignAnalyticsPagination,
  DailySeriesPoint,
  DispatchPage,
  FormFunnelRow,
  IBackofficeCampaignAnalyticsRepository,
  LeadsByOriginRow,
  TemplateAggregate,
} from "./IBackofficeCampaignAnalyticsRepository"

const FUNNEL_EVENT_TYPES = ["form_viewed", "form_started", "form_completed", "lead_created", "lead_attached"] as const

function buildDispatchWhere(filter: CampaignAnalyticsFilter): Prisma.EmailCampaignDispatchWhereInput {
  return {
    dispatchedAt: { gte: filter.from, lt: filter.to },
    ...(filter.teamIds?.length ? { teamId: { in: filter.teamIds } } : {}),
  }
}

export class BackofficeCampaignAnalyticsRepository implements IBackofficeCampaignAnalyticsRepository {
  async aggregateDispatches(
    filter: CampaignAnalyticsFilter,
    pagination: CampaignAnalyticsPagination
  ): Promise<DispatchPage> {
    const where = buildDispatchWhere(filter)
    const skip = (pagination.page - 1) * pagination.pageSize

    const [rows, total] = await Promise.all([
      prisma.emailCampaignDispatch.findMany({
        where,
        orderBy: { dispatchedAt: "desc" },
        skip,
        take: pagination.pageSize,
        select: {
          id: true,
          teamId: true,
          team: { select: { name: true } },
          templateName: true,
          dispatchedAt: true,
          status: true,
          totalRecipients: true,
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalClicked: true,
          totalBounced: true,
          errorMessage: true,
        },
      }),
      prisma.emailCampaignDispatch.count({ where }),
    ])

    return {
      rows: rows.map((row) => ({
        id: row.id,
        teamId: row.teamId,
        teamName: row.team.name,
        templateName: row.templateName,
        dispatchedAt: row.dispatchedAt,
        status: row.status,
        totalRecipients: row.totalRecipients,
        totalSent: row.totalSent,
        totalDelivered: row.totalDelivered,
        totalOpened: row.totalOpened,
        totalClicked: row.totalClicked,
        totalBounced: row.totalBounced,
        errorMessage: row.errorMessage ? row.errorMessage.slice(0, 300) : null,
      })),
      total,
      page: pagination.page,
      pageSize: pagination.pageSize,
    }
  }

  async aggregateByTemplate(filter: CampaignAnalyticsFilter): Promise<TemplateAggregate[]> {
    const where = buildDispatchWhere(filter)

    const [totals, failed] = await Promise.all([
      prisma.emailCampaignDispatch.groupBy({
        by: ["teamId", "templateName"],
        where,
        _count: { _all: true },
        _sum: {
          totalSent: true,
          totalDelivered: true,
          totalOpened: true,
          totalClicked: true,
          totalBounced: true,
        },
      }),
      prisma.emailCampaignDispatch.groupBy({
        by: ["teamId", "templateName"],
        where: { ...where, status: "failed" },
        _count: { _all: true },
      }),
    ])

    const teamNameById = await this.resolveTeamNames(totals.map((row) => row.teamId))
    const failedByKey = new Map(failed.map((row) => [`${row.teamId}::${row.templateName}`, row._count._all]))

    return totals.map((row) => ({
      teamId: row.teamId,
      teamName: teamNameById.get(row.teamId) ?? row.teamId,
      templateName: row.templateName,
      dispatches: row._count._all,
      sent: row._sum.totalSent ?? 0,
      delivered: row._sum.totalDelivered ?? 0,
      opened: row._sum.totalOpened ?? 0,
      clicked: row._sum.totalClicked ?? 0,
      bounced: row._sum.totalBounced ?? 0,
      failed: failedByKey.get(`${row.teamId}::${row.templateName}`) ?? 0,
    }))
  }

  async dailySeries(filter: CampaignAnalyticsFilter): Promise<DailySeriesPoint[]> {
    const teamFilter = filter.teamIds?.length
      ? Prisma.sql`AND "teamId" = ANY(${filter.teamIds}::uuid[])`
      : Prisma.empty

    const rows = await prisma.$queryRaw<Array<{ day: Date; teamId: string; sent: number; delivered: number; opened: number; clicked: number }>>(Prisma.sql`
      SELECT
        date_trunc('day', "dispatchedAt") AS day,
        "teamId" AS "teamId",
        SUM("totalSent")::int AS sent,
        SUM("totalDelivered")::int AS delivered,
        SUM("totalOpened")::int AS opened,
        SUM("totalClicked")::int AS clicked
      FROM "corretor_studio_email_campaign_dispatches"
      WHERE "dispatchedAt" >= ${filter.from} AND "dispatchedAt" < ${filter.to}
      ${teamFilter}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `)

    const teamIds = [...new Set(rows.map((row) => row.teamId))]
    const teamNameById = await this.resolveTeamNames(teamIds)

    return rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      teamId: row.teamId,
      teamName: teamNameById.get(row.teamId) ?? row.teamId,
      sent: Number(row.sent),
      delivered: Number(row.delivered),
      opened: Number(row.opened),
      clicked: Number(row.clicked),
    }))
  }

  async formFunnel(filter: CampaignAnalyticsFilter): Promise<FormFunnelRow[]> {
    // Prisma Client não expressa COALESCE nem "chave JSON não existe" com lógica
    // de três valores segura (ver MetricEventAggregationSql.ts) — daqui pra
    // frente é SQL cru, ancorado no mesmo predicado de período/fabricação que o
    // funil de formulário público já usa.
    const teamFilter = filter.teamIds?.length
      ? Prisma.sql`AND f."teamId" = ANY(${filter.teamIds}::uuid[])`
      : Prisma.empty

    const grouped = await prisma.$queryRaw<Array<{ formId: string; eventType: string; count: bigint }>>(Prisma.sql`
      SELECT e."formId" AS "formId", e."eventType"::text AS "eventType", COUNT(*) AS count
      FROM "corretor_studio_public_form_metric_events" e
      JOIN "corretor_studio_public_forms" f ON f.id = e."formId"
      WHERE e."eventType" = ANY(${[...FUNNEL_EVENT_TYPES]}::"PublicFormMetricType"[])
        AND ${notFabricatedByDispatcherSql("e")}
        AND ${periodAnchorSql("e")} >= ${filter.from}
        AND ${periodAnchorSql("e")} < ${filter.to}
        ${teamFilter}
      GROUP BY 1, 2
    `)

    if (grouped.length === 0) return []

    const formIds = [...new Set(grouped.map((row) => row.formId))]
    const forms = await prisma.publicForm.findMany({
      where: { id: { in: formIds } },
      select: { id: true, name: true, teamId: true, team: { select: { name: true } } },
    })
    const formById = new Map(forms.map((form) => [form.id, form]))

    const funnelByForm = new Map<string, FormFunnelRow>()
    for (const row of grouped) {
      const form = formById.get(row.formId)
      if (!form) continue

      const existing = funnelByForm.get(row.formId) ?? {
        formId: row.formId,
        formName: form.name,
        teamId: form.teamId,
        teamName: form.team.name,
        viewed: 0,
        started: 0,
        completed: 0,
        leadCreated: 0,
        leadAttached: 0,
      }

      const count = Number(row.count)
      if (row.eventType === "form_viewed") existing.viewed = count
      if (row.eventType === "form_started") existing.started = count
      if (row.eventType === "form_completed") existing.completed = count
      if (row.eventType === "lead_created") existing.leadCreated = count
      if (row.eventType === "lead_attached") existing.leadAttached = count

      funnelByForm.set(row.formId, existing)
    }

    return [...funnelByForm.values()]
  }

  async leadsByOrigin(filter: CampaignAnalyticsFilter): Promise<LeadsByOriginRow[]> {
    const grouped = await prisma.lead.groupBy({
      by: ["teamId", "originChannel"],
      where: {
        originChannel: { in: ["email_campaign", "public_form"] },
        deletedAt: null,
        createdAt: { gte: filter.from, lt: filter.to },
        teamId: filter.teamIds?.length ? { in: filter.teamIds } : { not: null },
      },
      _count: { _all: true },
    })

    const teamIds = [...new Set(grouped.map((row) => row.teamId).filter((id): id is string => Boolean(id)))]
    const teamNameById = await this.resolveTeamNames(teamIds)

    return grouped
      .filter((row): row is typeof row & { teamId: string; originChannel: "email_campaign" | "public_form" } =>
        Boolean(row.teamId && row.originChannel)
      )
      .map((row) => ({
        teamId: row.teamId,
        teamName: teamNameById.get(row.teamId) ?? row.teamId,
        originChannel: row.originChannel,
        count: row._count._all,
      }))
  }

  private async resolveTeamNames(teamIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(teamIds)]
    if (uniqueIds.length === 0) return new Map()

    const teams = await prisma.team.findMany({ where: { id: { in: uniqueIds } }, select: { id: true, name: true } })
    return new Map(teams.map((team) => [team.id, team.name]))
  }
}

export const backofficeCampaignAnalyticsRepository = new BackofficeCampaignAnalyticsRepository()
