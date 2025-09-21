import { DashboardFilters, TimePeriod } from "../types";
import { Output } from "@/lib/output";

/**
 * Interface para o serviço do Dashboard
 * Seguindo padrões SOLID - Single Responsibility Principle
 */
export interface IDashboardService {
  /**
   * Busca métricas completas do dashboard
   */
  getDashboardMetrics(supabaseId: string, filters?: DashboardFilters): Promise<Output>;
  
  /**
   * Busca apenas dados dos gráficos
   */
  getChartData(supabaseId: string, chartType: string): Promise<Output>;
  
  /**
   * Atualiza período de análise
   */
  updatePeriod(period: TimePeriod): void;
  
  /**
   * Força atualização dos dados
   */
  refreshData(supabaseId: string): Promise<Output>;
}