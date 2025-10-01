export interface DashboardMetricsData {
  agendamentos: number;
  negociacao: number;
  implementacao: number;
  vendas: number;
  NoShow: number;
  taxaConversao: number;
  receitaTotal: number;
  churnRate: number;
  leadsPorPeriodo: Array<{
    periodo: string;
    total: number;
  }>;
  statusCount: Record<string, number>;
}

export interface DetailedMetricsData {
  status: string;
  count: number;
  averageValue: number;
  totalValue: number;
}

export interface MetricsFilters {
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
  startDate?: string;
  endDate?: string;
}

export interface IDashboardMetricsService {
  getMetrics(supabaseId: string, filters?: MetricsFilters): Promise<DashboardMetricsData>;
  getDetailedMetrics(supabaseId: string): Promise<DetailedMetricsData[]>;
}