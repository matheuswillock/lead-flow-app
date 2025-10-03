import { 
  IDashboardMetricsService, 
  DashboardMetricsData, 
  DetailedMetricsData, 
  MetricsFilters 
} from "./IDashboardMetricsService";

// Re-exportar os tipos para facilitar importação
export type { DashboardMetricsData, DetailedMetricsData, MetricsFilters };

export class DashboardMetricsService implements IDashboardMetricsService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }

  /**
   * Busca métricas gerais do dashboard
   */
  async getMetrics(supabaseId: string, filters?: MetricsFilters): Promise<DashboardMetricsData> {
    try {
      // Construir query params
      const params = new URLSearchParams({
        supabaseId,
      });

      if (filters?.period) {
        params.append('period', filters.period);
      }

      if (filters?.startDate) {
        params.append('startDate', filters.startDate);
      }

      if (filters?.endDate) {
        params.append('endDate', filters.endDate);
      }

      // Fazer requisição para a API
      const response = await fetch(`${this.baseUrl}/api/v1/dashboard/metrics?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.isValid) {
        throw new Error(data.errorMessages?.join(', ') || 'Erro desconhecido');
      }

      return data.result;

    } catch (error) {
      console.error('Erro ao buscar métricas do dashboard:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Erro interno ao buscar métricas'
      );
    }
  }

  /**
   * Busca métricas detalhadas por status
   */
  async getDetailedMetrics(supabaseId: string): Promise<DetailedMetricsData[]> {
    try {
      // Fazer requisição para a API
      const response = await fetch(`${this.baseUrl}/api/v1/dashboard/metrics/detailed/${supabaseId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.isValid) {
        throw new Error(data.errorMessages?.join(', ') || 'Erro desconhecido');
      }

      return data.result;

    } catch (error) {
      console.error('Erro ao buscar métricas detalhadas:', error);
      throw new Error(
        error instanceof Error 
          ? error.message 
          : 'Erro interno ao buscar métricas detalhadas'
      );
    }
  }
}

// Instância única para uso em toda aplicação (Singleton)
export const dashboardMetricsService = new DashboardMetricsService();