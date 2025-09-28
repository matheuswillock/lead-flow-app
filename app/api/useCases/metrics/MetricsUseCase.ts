import { Output } from "@/lib/output";
import { DashboardInfosService, DashboardFilters } from "@/app/api/services/DashboardInfosService";
import type { IMetricsUseCase, MetricsFilters } from "./IMetricsUseCase";

export class MetricsUseCase implements IMetricsUseCase {
  
  /**
   * Busca métricas do dashboard
   */
  async getDashboardMetrics(filters: MetricsFilters): Promise<Output> {
    try {
      // Validar entrada
      if (!filters.managerId) {
        return new Output(
          false,
          [],
          ['managerId é obrigatório'],
          null
        );
      }

      // Converter para o formato do serviço
      const serviceFilters: DashboardFilters = {
        managerId: filters.managerId,
        period: filters.period || '30d',
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      };

      // Chamar o serviço
      const metrics = await DashboardInfosService.getDashboardMetrics(serviceFilters);

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
  async getDetailedStatusMetrics(managerId: string): Promise<Output> {
    try {
      // Validar entrada
      if (!managerId) {
        return new Output(
          false,
          [],
          ['managerId é obrigatório'],
          null
        );
      }

      // Chamar o serviço
      const detailedMetrics = await DashboardInfosService.getDetailedStatusMetrics(managerId);

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

// Instância única para uso em toda aplicação
export const metricsUseCase = new MetricsUseCase();