import { MeetingHeald } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import { isManagerLikeRole } from "@/lib/roles";
import type {
  IMetricsRepository,
  TeamContext,
  MetricsFiltersWithContext,
  LeadMetricsData,
  StatusMetricsData,
  LeadsPeriodData,
  MetricsFilters,
  ScheduleMetricsData,
  ScheduledLeadIdData,
  MeetingHeldLeadMetricsData,
  SaleMetricsData
} from "./IMetricsRepository";

export class MetricsRepository implements IMetricsRepository {
  // ---------------------------------------------------------------------------
  // Contexto de time — resolve uma única vez por request
  // ---------------------------------------------------------------------------

  private async getTeamContext(supabaseId: string, teamId: string): Promise<TeamContext> {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!profile) {
      throw new Error("Profile não encontrado");
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { teamId_profileId: { teamId, profileId: profile.id } },
      select: { role: true, functions: true },
    });

    if (!teamMember) {
      throw new Error("Acesso negado para este time");
    }

    if (
      teamMember.role === "operator" &&
      !teamMember.functions.includes("SDR") &&
      !teamMember.functions.includes("CLOSER")
    ) {
      throw new Error("Acesso negado: função SDR ou CLOSER necessária para visualizar leads.");
    }

    return { profileId: profile.id, teamMember };
  }

  async resolveTeamContext(supabaseId: string, teamId: string): Promise<TeamContext> {
    return this.getTeamContext(supabaseId, teamId);
  }

  // ---------------------------------------------------------------------------
  // Helpers privados de where clause
  // ---------------------------------------------------------------------------

  private resolveTeamIds(teamId: string, teamIds?: string[]): string[] {
    if (teamIds && teamIds.length > 0) {
      return teamIds;
    }
    return [teamId];
  }

  private resolveTeamFilter(teamIds: string[]) {
    return teamIds.length === 1 ? { teamId: teamIds[0] } : { teamId: { in: teamIds } };
  }

  private buildLeadWhere(
    ctx: TeamContext,
    teamIds: string[],
    dateField: "createdAt" | "meetingDate",
    startDate?: Date,
    endDate?: Date,
    extraWhere?: object
  ) {
    const dateFilter =
      startDate && endDate ? { [dateField]: { gte: startDate, lte: endDate } } : {};

    const extraWhereWithoutDateField = extraWhere
      ? Object.fromEntries(
          Object.entries(extraWhere).filter(([key]) => key !== dateField)
        )
      : {};

    const extraDateFilter =
      extraWhere && dateField in extraWhere
        ? (extraWhere as Record<string, unknown>)[dateField]
        : undefined;

    const mergedDateFilter =
      dateFilter[dateField] && extraDateFilter
        ? {
            [dateField]: {
              ...(dateFilter[dateField] as object),
              ...(extraDateFilter as object),
            },
          }
        : dateFilter[dateField]
        ? dateFilter
        : extraDateFilter
        ? { [dateField]: extraDateFilter }
        : {};

    if (isManagerLikeRole(ctx.teamMember.role)) {
      return { ...this.resolveTeamFilter(teamIds), ...extraWhereWithoutDateField, ...mergedDateFilter };
    }

    return {
      OR: [{ assignedTo: ctx.profileId }, { createdBy: ctx.profileId }],
      ...this.resolveTeamFilter(teamIds),
      ...extraWhereWithoutDateField,
      ...mergedDateFilter,
    };
  }

  private buildLeadFinalizedWhere(
    ctx: TeamContext,
    teamIds: string[],
    startDate?: Date,
    endDate?: Date
  ) {
    const dateFilter =
      startDate && endDate ? { finalizedDateAt: { gte: startDate, lte: endDate } } : {};

    if (isManagerLikeRole(ctx.teamMember.role)) {
      return { lead: this.resolveTeamFilter(teamIds), ...dateFilter };
    }

    return {
      lead: {
        OR: [{ assignedTo: ctx.profileId }, { createdBy: ctx.profileId }],
        ...this.resolveTeamFilter(teamIds),
      },
      ...dateFilter,
    };
  }

  private buildMeetingsHeldWhere(
    ctx: TeamContext,
    teamIds: string[],
    startDate?: Date,
    endDate?: Date
  ) {
    const dateFilter =
      startDate && endDate ? { meetingDate: { gte: startDate, lte: endDate } } : {};

    if (isManagerLikeRole(ctx.teamMember.role)) {
      return { ...this.resolveTeamFilter(teamIds), meetingHeald: MeetingHeald.yes, ...dateFilter };
    }

    return {
      ...this.resolveTeamFilter(teamIds),
      meetingHeald: MeetingHeald.yes,
      OR: [
        { assignedTo: ctx.profileId },
        { createdBy: ctx.profileId },
        { closerId: ctx.profileId },
      ],
      ...dateFilter,
    };
  }

  // ---------------------------------------------------------------------------
  // findLeadsForMetrics
  // ---------------------------------------------------------------------------

  async findLeadsForMetrics(filters: MetricsFilters): Promise<LeadMetricsData[]> {
    const ctx = await this.getTeamContext(filters.supabaseId, filters.teamId);
    return this.findLeadsForMetricsWithCtx({ ...filters, ctx });
  }

  async findLeadsForMetricsWithCtx(filters: MetricsFiltersWithContext): Promise<LeadMetricsData[]> {
    const { ctx, teamId, teamIds, startDate, endDate } = filters;
    const resolvedTeamIds = this.resolveTeamIds(teamId, teamIds);
    return prisma.lead.findMany({
      where: this.buildLeadWhere(ctx, resolvedTeamIds, "createdAt", startDate, endDate),
      select: {
        id: true,
        status: true,
        currentValue: true,
        ticket: true,
        createdAt: true,
        statusEnteredAt: true,
        meetingDate: true,
        meetingHeald: true,
        assignedTo: true,
        closerId: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // getFinalizedLeads
  // ---------------------------------------------------------------------------

  async getFinalizedLeads(filters: MetricsFilters): Promise<SaleMetricsData[]> {
    const ctx = await this.getTeamContext(filters.supabaseId, filters.teamId);
    return this.getFinalizedLeadsWithCtx({ ...filters, ctx });
  }

  async getFinalizedLeadsWithCtx(filters: MetricsFiltersWithContext): Promise<SaleMetricsData[]> {
    const { ctx, teamId, teamIds, startDate, endDate } = filters;
    const resolvedTeamIds = this.resolveTeamIds(teamId, teamIds);
    return prisma.leadFinalized.findMany({
      where: this.buildLeadFinalizedWhere(ctx, resolvedTeamIds, startDate, endDate),
      select: {
        id: true,
        leadId: true,
        amount: true,
        finalizedDateAt: true,
        startDateAt: true,
        duration: true,
        lead: { select: { createdAt: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // getMeetingsHeldLeads
  // ---------------------------------------------------------------------------

  async getMeetingsHeldLeads(filters: MetricsFilters): Promise<MeetingHeldLeadMetricsData[]> {
    const ctx = await this.getTeamContext(filters.supabaseId, filters.teamId);
    return this.getMeetingsHeldLeadsWithCtx({ ...filters, ctx });
  }

  async getMeetingsHeldLeadsWithCtx(
    filters: MetricsFiltersWithContext
  ): Promise<MeetingHeldLeadMetricsData[]> {
    const { ctx, teamId, teamIds, startDate, endDate } = filters;
    const resolvedTeamIds = this.resolveTeamIds(teamId, teamIds);
    return prisma.lead.findMany({
      where: this.buildMeetingsHeldWhere(ctx, resolvedTeamIds, startDate, endDate),
      select: {
        meetingDate: true,
        assignedTo: true,
        closerId: true,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // getLeadsByPeriod
  // ---------------------------------------------------------------------------

  async getLeadsByPeriod(
    supabaseId: string,
    teamId: string,
    startDate: Date,
    endDate: Date
  ): Promise<LeadsPeriodData[]> {
    const ctx = await this.getTeamContext(supabaseId, teamId);
    return this.getLeadsByPeriodWithCtx(ctx, [teamId], startDate, endDate);
  }

  async getLeadsByPeriodWithCtx(
    ctx: TeamContext,
    teamIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<LeadsPeriodData[]> {
    const results = await prisma.lead.groupBy({
      by: ["createdAt"],
      where: this.buildLeadWhere(ctx, teamIds, "createdAt", startDate, endDate),
      _count: { _all: true },
      orderBy: { createdAt: "asc" },
    });

    return results.map((result) => ({
      createdAt: result.createdAt,
      _count: { id: result._count._all },
    }));
  }

  // ---------------------------------------------------------------------------
  // getStatusMetrics
  // ---------------------------------------------------------------------------

  async getStatusMetrics(supabaseId: string, teamId: string): Promise<StatusMetricsData[]> {
    const ctx = await this.getTeamContext(supabaseId, teamId);
    return this.getStatusMetricsWithCtx(ctx, [teamId]);
  }

  async getStatusMetricsWithCtx(ctx: TeamContext, teamIds: string[]): Promise<StatusMetricsData[]> {
    const results = await prisma.lead.groupBy({
      by: ["status"],
      where: this.buildLeadWhere(ctx, teamIds, "createdAt"),
      _count: { _all: true },
      _avg: { currentValue: true },
      _sum: { currentValue: true },
    });

    return results.map((result) => ({
      status: result.status,
      _count: { id: result._count._all },
      _avg: result._avg,
      _sum: result._sum,
    }));
  }

  // ---------------------------------------------------------------------------
  // getScheduledLeads
  // ---------------------------------------------------------------------------

  async getScheduledLeads(filters: MetricsFilters): Promise<ScheduleMetricsData[]> {
    const { supabaseId, teamId } = filters;
    const ctx = await this.getTeamContext(supabaseId, teamId);
    return this.getScheduledLeadsWithCtx({ ...filters, ctx });
  }

  async getScheduledLeadsWithCtx(filters: MetricsFiltersWithContext): Promise<ScheduleMetricsData[]> {
    const { ctx, teamId, teamIds, startDate, endDate } = filters;
    const resolvedTeamIds = this.resolveTeamIds(teamId, teamIds);

    const dateFilter =
      startDate && endDate ? { date: { gte: startDate, lte: endDate } } : {};

    let whereClause: object;

    if (isManagerLikeRole(ctx.teamMember.role)) {
      whereClause = { lead: this.resolveTeamFilter(resolvedTeamIds), ...dateFilter };
    } else {
      whereClause = {
        lead: {
          OR: [{ assignedTo: ctx.profileId }, { createdBy: ctx.profileId }],
          ...this.resolveTeamFilter(resolvedTeamIds),
        },
        ...dateFilter,
      };
    }

    return prisma.leadsSchedule.findMany({
      where: whereClause,
      select: { id: true, leadId: true, date: true, createdAt: true },
    });
  }

  async getLeadsWithMeetingDateWithCtx(
    filters: MetricsFiltersWithContext
  ): Promise<ScheduledLeadIdData[]> {
    const { ctx, teamId, teamIds, startDate, endDate } = filters;
    const resolvedTeamIds = this.resolveTeamIds(teamId, teamIds);
    const leads = await prisma.lead.findMany({
      where: this.buildLeadWhere(ctx, resolvedTeamIds, "meetingDate", startDate, endDate, {
        meetingDate: { not: null },
      }),
      select: { id: true },
    });

    return leads.map((lead) => ({ leadId: lead.id }));
  }
}

// Instância única para uso em toda aplicação
export const metricsRepository = new MetricsRepository();
