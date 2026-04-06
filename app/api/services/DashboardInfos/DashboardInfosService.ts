import { LeadStatus } from "@prisma/client";
import { metricsRepository } from "@/app/api/infra/data/repositories/metrics/MetricsRepository";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";
import { prisma } from "@/app/api/infra/data/prisma";
import { IDashboardInfosService } from "./IDashboardInfosService";
import { DashboardMetrics } from "./types/DashboardMetrics";
import { DashboardFilters } from "./types/DashboardFilters";
import { DetailedStatusMetrics } from "./types/DetailedStatusMetrics";

/**
 * Status Groups for metrics calculation
 *
 * Scheduled: scheduled
 * Negotiation: offerNegotiation + pricingRequest (Quote)
 * Implementation: offerSubmission (Proposal) + dps_agreement (DPS) + invoicePayment (Invoice) + pending_documents (Pending Documents)
 * Sales: contract_finalized
 * Churn: operator_denied (Denied by operator)
 */
const STATUS_GROUPS = {
  SCHEDULED: ["scheduled"] as LeadStatus[],
  NEGOTIATION: ["offerNegotiation", "pricingRequest"] as LeadStatus[],
  IMPLEMENTATION: [
    "offerSubmission",    // Proposal
    "dps_agreement",      // DPS
    "invoicePayment",     // Invoice
    "pending_documents"   // Pending Documents
  ] as LeadStatus[],
  SALES: ["contract_finalized"] as LeadStatus[],
  CHURN: ["operator_denied"] as LeadStatus[],
  NO_SHOW: ["no_show"] as LeadStatus[],
} as const;

export class DashboardInfosService implements IDashboardInfosService {
  async getDashboardMetrics(filters: DashboardFilters, ctx: TeamContext): Promise<DashboardMetrics> {
    const { teamId, startDate, endDate } = filters;

    const ctxFilters = { supabaseId: '', teamId, startDate, endDate, ctx };

    // Round 1: todas as queries independentes em paralelo
    const [leads, finalizedLeads, meetingsHeldLeads, teamMembers, team] = await Promise.all([
      metricsRepository.findLeadsForMetricsWithCtx(ctxFilters),
      metricsRepository.getFinalizedLeadsWithCtx(ctxFilters),
      metricsRepository.getMeetingsHeldLeadsWithCtx(ctxFilters),
      prisma.teamMember.findMany({
        where: { teamId },
        select: {
          profileId: true,
          functions: true,
          profile: {
            select: {
              fullName: true,
              email: true,
              profileIconUrl: true,
              functions: true,
            },
          },
        },
      }),
      prisma.team.findUnique({
        where: { id: teamId },
        select: { masterId: true },
      }),
    ]);

    // Round 2: lead.count depende do masterId — inicia em paralelo com getLeadsByPeriod
    const periodFilters = this.resolvePeriodDates(filters);

    const [masterLeadCount, leadsPorPeriodo] = await Promise.all([
      team?.masterId
        ? prisma.lead.count({
            where: {
              managerId: team.masterId,
              teamId,
              ...(startDate && endDate && { createdAt: { gte: startDate, lte: endDate } }),
            },
          })
        : Promise.resolve(leads.length),
      this.buildLeadsByPeriod(ctx, filters, periodFilters, finalizedLeads),
    ]);

    // Cálculos em memória
    const vendas = finalizedLeads.length;

    const hasFunction = (
      member: { functions: string[]; profile?: { functions: string[] | null } | null },
      fn: "SDR" | "CLOSER"
    ) => {
      const memberFunctions = member.functions ?? [];
      const profileFunctions = member.profile?.functions ?? [];
      return memberFunctions.includes(fn) || profileFunctions.includes(fn);
    };

    const sdrIds = new Set(
      teamMembers.filter((m) => hasFunction(m, "SDR")).map((m) => m.profileId)
    );
    const closerIds = new Set(
      teamMembers.filter((m) => hasFunction(m, "CLOSER")).map((m) => m.profileId)
    );

    const closerCounts = new Map<string, number>();
    const sdrCounts = new Map<string, number>();

    meetingsHeldLeads.forEach((lead) => {
      if (lead.closerId && closerIds.has(lead.closerId)) {
        closerCounts.set(lead.closerId, (closerCounts.get(lead.closerId) || 0) + 1);
      }
      if (lead.assignedTo && sdrIds.has(lead.assignedTo)) {
        sdrCounts.set(lead.assignedTo, (sdrCounts.get(lead.assignedTo) || 0) + 1);
      }
    });

    const reunioesRealizadasCloser = Array.from(closerCounts.values()).reduce(
      (sum, v) => sum + v,
      0
    );
    const reunioesRealizadasSdr = Array.from(sdrCounts.values()).reduce(
      (sum, v) => sum + v,
      0
    );

    const toProfileRankingItem = (member: (typeof teamMembers)[number]) => ({
      id: member.profileId,
      name: member.profile?.fullName || member.profile?.email || "Usuário",
      email: member.profile?.email || "",
      avatarUrl: member.profile?.profileIconUrl || null,
    });

    const buildRanking = (
      profiles: Array<{ id: string; name: string; email: string; avatarUrl: string | null }>,
      counts: Map<string, number>
    ) =>
      profiles
        .map((p) => ({ ...p, count: counts.get(p.id) || 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const reunioesRealizadasCloserRanking = buildRanking(
      teamMembers.filter((m) => hasFunction(m, "CLOSER")).map(toProfileRankingItem),
      closerCounts
    );
    const reunioesRealizadasSdrRanking = buildRanking(
      teamMembers.filter((m) => hasFunction(m, "SDR")).map(toProfileRankingItem),
      sdrCounts
    );

    const statusCount = leads.reduce((acc: Record<LeadStatus, number>, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<LeadStatus, number>);

    Object.values(LeadStatus).forEach((status) => {
      if (!(status in statusCount)) statusCount[status] = 0;
    });

    const negociacao = this.countByStatusGroup(statusCount, STATUS_GROUPS.NEGOTIATION);
    const implementacao = this.countByStatusGroup(statusCount, STATUS_GROUPS.IMPLEMENTATION);
    const churn = this.countByStatusGroup(statusCount, STATUS_GROUPS.CHURN);
    const noShowCount = this.countByStatusGroup(statusCount, STATUS_GROUPS.NO_SHOW);

    const agendamentos = masterLeadCount;
    const taxaConversao = agendamentos > 0 ? (vendas / agendamentos) * 100 : 0;
    const churnRate = vendas > 0 ? (churn / vendas) * 100 : 0;
    const noShowRate = agendamentos > 0 ? (noShowCount / agendamentos) * 100 : 0;

    const receitaTotal = leads
      .filter((l) => l.status === "contract_finalized" && l.ticket !== null)
      .reduce((total, l) => total + Number(l.ticket || 0), 0);

    const ticket = leads.reduce((total, l) => total + Number(l.ticket || 0), 0);
    const cadencia = leads.reduce((total, l) => total + Number(l.currentValue || 0), 0);

    return {
      agendamentos,
      negociacao,
      implementacao,
      vendas,
      reunioesRealizadasCloser,
      reunioesRealizadasSdr,
      taxaConversao: Math.round(taxaConversao * 100) / 100,
      receitaTotal,
      ticket,
      churnRate: Math.round(churnRate * 100) / 100,
      noShowRate: Math.round(noShowRate * 100) / 100,
      cadencia,
      leadsPorPeriodo,
      reunioesRealizadasCloserRanking,
      reunioesRealizadasSdrRanking,
      statusCount,
    };
  }

  private countByStatusGroup(
    statusCount: Record<LeadStatus, number>,
    statusGroup: readonly LeadStatus[]
  ): number {
    return statusGroup.reduce((total, status) => total + (statusCount[status] || 0), 0);
  }

  /**
   * Resolve as datas de início/fim para o gráfico por período.
   * Usa startDate/endDate customizados se fornecidos, caso contrário usa o period.
   */
  private resolvePeriodDates(filters: DashboardFilters): { startDate: Date; endDate: Date } {
    if (filters.startDate && filters.endDate) {
      return { startDate: filters.startDate, endDate: filters.endDate };
    }

    const endDate = new Date();
    const periodMs: Record<string, number> = {
      "7d": 7,
      "30d": 30,
      "3m": 90,
      "6m": 180,
      "1y": 365,
    };
    const days = periodMs[filters.period ?? "30d"] ?? 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return { startDate, endDate };
  }

  /**
   * Constrói os dados de leads por período reutilizando finalizedLeads já buscados.
   */
  private async buildLeadsByPeriod(
    ctx: import("@/app/api/infra/data/repositories/metrics/IMetricsRepository").TeamContext,
    filters: DashboardFilters,
    periodDates: { startDate: Date; endDate: Date },
    finalizedLeads: import("@/app/api/infra/data/repositories/metrics/IMetricsRepository").SaleMetricsData[]
  ) {
    const { supabaseId, teamId, period = "30d" } = filters;
    const { startDate, endDate } = periodDates;

    const leadsByPeriod = await metricsRepository.getLeadsByPeriodWithCtx(
      ctx,
      teamId,
      startDate,
      endDate
    );

    const groupedLeads = this.groupLeadsByTimeInterval(leadsByPeriod, period);
    const groupedConversions = this.groupConversionsByTimeInterval(finalizedLeads, period);

    return groupedLeads.map((item) => ({
      periodo: item.date,
      leads: item.count,
      conversoes: groupedConversions.get(item.date) || 0,
    }));
  }

  private groupLeadsByTimeInterval(
    leads: Array<{ createdAt: Date; _count: { id: number } }>,
    period: string
  ) {
    const grouped = new Map<string, number>();

    leads.forEach((lead) => {
      const key =
        period === "7d" || period === "30d"
          ? lead.createdAt.toISOString().split("T")[0]
          : (() => {
              const d = new Date(lead.createdAt);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            })();
      grouped.set(key, (grouped.get(key) || 0) + lead._count.id);
    });

    return Array.from(grouped.entries()).map(([date, count]) => ({ date, count }));
  }

  /**
   * Agrupa conversões por intervalo de tempo.
   * IMPORTANTE: agrupa pela data de CRIAÇÃO do lead, não pela data de finalização.
   */
  private groupConversionsByTimeInterval(
    conversions: Array<{ finalizedDateAt: Date; lead: { createdAt: Date } }>,
    period: string
  ): Map<string, number> {
    const grouped = new Map<string, number>();

    conversions.forEach((conversion) => {
      const key =
        period === "7d" || period === "30d"
          ? conversion.lead.createdAt.toISOString().split("T")[0]
          : (() => {
              const d = new Date(conversion.lead.createdAt);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            })();
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return grouped;
  }

  async getDetailedStatusMetrics(
    _supabaseId: string,
    teamId: string,
    ctx: TeamContext
  ): Promise<DetailedStatusMetrics[]> {
    const statusMetrics = await metricsRepository.getStatusMetricsWithCtx(ctx, teamId);

    return statusMetrics.map((metric) => ({
      status: metric.status,
      count: metric._count.id,
      averageValue: Number(metric._avg.currentValue || 0),
      totalValue: Number(metric._sum.currentValue || 0),
    }));
  }
}
