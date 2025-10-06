import { Output } from "@/lib/output";
import type { IMetricsUseCase, MetricsFilters } from "./IMetricsUseCase";
import { DashboardFilters } from "../../services/DashboardInfos/types/DashboardFilters";
import { IDashboardInfosService } from "../../services";

export class MetricsUseCase implements IMetricsUseCase {
  constructor(private dashboardInfosService: IDashboardInfosService) {}

  /**
   * Busca métricas do dashboard
   */
  async getDashboardMetrics(filters: MetricsFilters): Promise<Output> {
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

      // Converter para o formato do serviço
      const serviceFilters: DashboardFilters = {
        supabaseId: filters.supabaseId,
        period: filters.period || '30d',
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      };

      // Chamar o serviço
      const metrics = await this.dashboardInfosService.getDashboardMetrics(serviceFilters);

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
  async getDetailedStatusMetrics(supabaseId: string): Promise<Output> {
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

      // Chamar o serviço
      const detailedMetrics = await this.dashboardInfosService.getDetailedStatusMetrics(supabaseId);

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
