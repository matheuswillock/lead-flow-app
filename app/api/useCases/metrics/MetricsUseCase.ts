import { Output } from "@/lib/output";
import type { IMetricsUseCase, MetricsFilters } from "./IMetricsUseCase";
import type { TeamContext } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";
import { DashboardFilters } from "../../services/DashboardInfos/types/DashboardFilters";
import { IDashboardInfosService } from "../../services";
import { addDaysInTz, endOfDayInTz, startOfDayInTz, addMonthsInTz, DEFAULT_TZ } from "@/lib/dates";

export class MetricsUseCase implements IMetricsUseCase {
  constructor(private dashboardInfosService: IDashboardInfosService) {}

  /**
   * Converte período em datas startDate e endDate respeitando o TZ do usuário
   */
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

  /**
   * Busca métricas do dashboard
   */
  async getDashboardMetrics(filters: MetricsFilters, ctx: TeamContext): Promise<Output> {
    try {
      // Validar entrada
      if (!filters.supabaseId) {
        return new Output(
          false,
          [],
          ['supabaseId é obrigatório'],
          null
        );
      }
      if (!filters.teamId) {
        return new Output(
          false,
          [],
          ['teamId é obrigatório'],
          null
        );
      }

      // Converter período em datas se necessário
      let startDate = filters.startDate;
      let endDate = filters.endDate;

      if (filters.period && !startDate && !endDate) {
        const tz = ctx.userTimezone ?? DEFAULT_TZ;
        const dates = this.convertPeriodToDates(filters.period, tz);
        startDate = dates.startDate;
        endDate = dates.endDate;
      }

      // Converter para o formato do serviço
      const serviceFilters: DashboardFilters = {
        supabaseId: filters.supabaseId,
        teamId: filters.teamId,
        period: filters.period || '30d',
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      };

      // Chamar o serviço
      const metrics = await this.dashboardInfosService.getDashboardMetrics(serviceFilters, ctx);

      return new Output(
        true,
        ['Métricas do dashboard carregadas com sucesso'],
        [],
        metrics
      );

    } catch (error) {
      console.error('Erro ao buscar métricas do dashboard:', error);
      
      return new Output(
        false,
        [],
        ['Erro interno do servidor ao buscar métricas'],
        null
      );
    }
  }

  /**
   * Busca métricas detalhadas por status
   */
  async getDetailedStatusMetrics(supabaseId: string, teamId: string, ctx: TeamContext): Promise<Output> {
    try {
      // Validar entrada
      if (!supabaseId) {
        return new Output(
          false,
          [],
          ['supabaseId é obrigatório'],
          null
        );
      }
      if (!teamId) {
        return new Output(
          false,
          [],
          ['teamId é obrigatório'],
          null
        );
      }

      // Chamar o serviço
      const detailedMetrics = await this.dashboardInfosService.getDetailedStatusMetrics(supabaseId, teamId, ctx);

      return new Output(
        true,
        ['Métricas detalhadas carregadas com sucesso'],
        [],
        detailedMetrics
      );

    } catch (error) {
      console.error('Erro ao buscar métricas detalhadas:', error);
      return new Output(
        false,
        [],
        ['Erro interno do servidor ao buscar métricas detalhadas'],
        null
      );
    }
  }
}
