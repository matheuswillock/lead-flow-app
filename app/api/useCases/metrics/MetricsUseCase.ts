import { cacheLife, cacheTag } from "next/cache";
import { Output } from "@/lib/output";
import { cacheTags } from "@/lib/cache/cacheTags";
import type { IMetricsUseCase, MetricsFilters } from "./IMetricsUseCase";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";
import type { IDashboardInfosService } from "../../services";
import { DashboardInfosService } from "../../services/DashboardInfos/DashboardInfosService";
import type { DashboardFilters } from "../../services/DashboardInfos/types/DashboardFilters";
import type { DashboardMetrics } from "../../services/DashboardInfos/types/DashboardMetrics";
import { addDaysInTz, endOfDayInTz, startOfDayInTz, addMonthsInTz, DEFAULT_TZ } from "@/lib/dates";

const defaultDashboardInfosService = new DashboardInfosService();

async function getCachedDashboardMetrics(
  activeTeamId: string,
  teamIds: string[],
  teamScope: "active" | "all",
  masterId: string,
  profileId: string,
  role: string,
  functionsKey: string,
  userTimezone: string,
  period: string,
  startDateISO: string,
  endDateISO: string,
): Promise<DashboardMetrics> {
  "use cache";
  if (teamScope === "all") {
    cacheTag(cacheTags.accountDashboard(masterId));
  } else {
    cacheTag(cacheTags.teamDashboard(activeTeamId));
  }
  cacheLife({ stale: 30, revalidate: 60 });

  const ctx: TeamContext = {
    profileId,
    userTimezone,
    teamMember: { role, functions: functionsKey ? functionsKey.split(",") : [] },
  };
  const serviceFilters: DashboardFilters = {
    supabaseId: profileId,
    teamId: activeTeamId,
    teamIds,
    teamScope,
    masterId,
    period: period as DashboardFilters["period"],
    startDate: new Date(startDateISO),
    endDate: new Date(endDateISO),
  };
  return defaultDashboardInfosService.getDashboardMetrics(serviceFilters, ctx);
}

export class MetricsUseCase implements IMetricsUseCase {
  constructor(private readonly dashboardInfosService: IDashboardInfosService) {}

  private convertPeriodToDates(period: '7d' | '30d' | '3m' | '6m' | '1y', tz: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = endOfDayInTz(now, tz);
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = startOfDayInTz(addDaysInTz(now, -7, tz), tz);
        break;
      case '30d':
        startDate = startOfDayInTz(addDaysInTz(now, -30, tz), tz);
        break;
      case '3m':
        startDate = startOfDayInTz(addMonthsInTz(now, -3, tz), tz);
        break;
      case '6m':
        startDate = startOfDayInTz(addMonthsInTz(now, -6, tz), tz);
        break;
      case '1y':
        startDate = startOfDayInTz(addMonthsInTz(now, -12, tz), tz);
        break;
    }

    return { startDate, endDate };
  }

  async getDashboardMetrics(filters: MetricsFilters, ctx: TeamContext): Promise<Output> {
    try {
      if (!filters.supabaseId) {
        return new Output(false, [], ['supabaseId é obrigatório'], null);
      }
      if (!filters.teamId) {
        return new Output(false, [], ['teamId é obrigatório'], null);
      }

      let startDate = filters.startDate;
      let endDate = filters.endDate;

      if (filters.period && !startDate && !endDate) {
        const tz = ctx.userTimezone ?? DEFAULT_TZ;
        const dates = this.convertPeriodToDates(filters.period, tz);
        startDate = dates.startDate;
        endDate = dates.endDate;
      }

      const resolvedStart = startDate ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const resolvedEnd = endDate ?? new Date();
      const teamIds = filters.teamIds?.length ? filters.teamIds : [filters.teamId];
      const teamScope = filters.teamScope ?? "active";
      const masterId = filters.masterId ?? filters.teamId;

      const metrics =
        this.dashboardInfosService === defaultDashboardInfosService
          ? await getCachedDashboardMetrics(
              filters.teamId,
              teamIds,
              teamScope,
              masterId,
              filters.supabaseId,
              ctx.teamMember.role,
              ctx.teamMember.functions.join(","),
              ctx.userTimezone ?? DEFAULT_TZ,
              filters.period || "30d",
              resolvedStart.toISOString(),
              resolvedEnd.toISOString(),
            )
          : await this.dashboardInfosService.getDashboardMetrics(
              {
                supabaseId: filters.supabaseId,
                teamId: filters.teamId,
                teamIds,
                teamScope,
                masterId,
                period: filters.period || "30d",
                ...(startDate && { startDate }),
                ...(endDate && { endDate }),
              },
              ctx,
            );

      return new Output(true, ['Métricas do dashboard carregadas com sucesso'], [], metrics);
    } catch (error) {
      console.error('Erro ao buscar métricas do dashboard:', error);
      return new Output(false, [], ['Erro interno do servidor ao buscar métricas'], null);
    }
  }

  async getDetailedStatusMetrics(
    supabaseId: string,
    teamId: string,
    teamIds: string[],
    ctx: TeamContext,
  ): Promise<Output> {
    try {
      if (!supabaseId) {
        return new Output(false, [], ['supabaseId é obrigatório'], null);
      }
      if (!teamId) {
        return new Output(false, [], ['teamId é obrigatório'], null);
      }

      const detailedMetrics = await this.dashboardInfosService.getDetailedStatusMetrics(
        supabaseId,
        teamId,
        teamIds,
        ctx,
      );
      return new Output(true, ['Métricas detalhadas carregadas com sucesso'], [], detailedMetrics);
    } catch (error) {
      console.error('Erro ao buscar métricas detalhadas:', error);
      return new Output(false, [], ['Erro interno do servidor ao buscar métricas detalhadas'], null);
    }
  }
}

export const metricsUseCase = new MetricsUseCase(defaultDashboardInfosService);
