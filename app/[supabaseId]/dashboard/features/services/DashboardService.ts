import { IDashboardService } from "./IDashboardService";
import { DashboardFilters, TimePeriod } from "../types";
import { Output } from "@/lib/output";

/**
 * Implementação do serviço de Dashboard
 * Seguindo padrões de Clean Architecture
 */
export class DashboardService implements IDashboardService {
  private baseUrl: string;
  private currentPeriod: TimePeriod = "30d";

  constructor() {
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://your-domain.com' 
      : 'http://localhost:3000';
  }

  /**
   * Busca métricas completas do dashboard
   */
  async getDashboardMetrics(supabaseId: string, filters?: DashboardFilters): Promise<Output> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters?.period) {
        queryParams.append('period', filters.period);
      }
      
      if (filters?.status?.length) {
        queryParams.append('status', filters.status.join(','));
      }
      
      if (filters?.performer) {
        queryParams.append('performer', filters.performer);
      }

      const url = `${this.baseUrl}/api/v1/dashboard/${supabaseId}/metrics?${queryParams}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Sempre buscar dados frescos
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao buscar métricas do dashboard:', error);
      return {
        isValid: false,
        errorMessages: ['Erro ao carregar dados do dashboard'],
        successMessages: [],
        result: null
      };
    }
  }

  /**
   * Busca apenas dados específicos de um gráfico
   */
  async getChartData(supabaseId: string, chartType: string): Promise<Output> {
    try {
      const url = `${this.baseUrl}/api/v1/dashboard/${supabaseId}/charts/${chartType}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Erro ao buscar dados do gráfico ${chartType}:`, error);
      return {
        isValid: false,
        errorMessages: [`Erro ao carregar gráfico ${chartType}`],
        successMessages: [],
        result: null
      };
    }
  }

  /**
   * Atualiza período de análise
   */
  updatePeriod(period: TimePeriod): void {
    this.currentPeriod = period;
  }

  /**
   * Força atualização dos dados
   */
  async refreshData(supabaseId: string): Promise<Output> {
    // Invalidar cache e buscar dados frescos
    return this.getDashboardMetrics(supabaseId, { 
      period: this.currentPeriod 
    });
  }

  /**
   * Getter para o período atual
   */
  getCurrentPeriod(): TimePeriod {
    return this.currentPeriod;
  }
}