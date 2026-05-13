export interface DashboardMetricsData {
  agendamentos: number;
  totalLeads: number;
  scheduledCount: number;
  noShowCount: number;
  salesCount: number;
  salesCountCrm: number;
  salesCountFinancial: number;
  negociacao: number;
  implementacao: number;
  vendas: number;
  vendasRealizadas: number;
  reunioesRealizadasCloser: number;
  reunioesRealizadasSdr: number;
  noShowRate: number;
  taxaConversao: number;
  conversionRate: number;
  conversionRateCrm: number;
  conversionRateFinancial: number;
  receitaTotal: number;
  ticket: number;
  churnRate: number;
  churnRateCrm: number;
  churnRateFinancial: number;
  cadencia: number;
  leadsPorPeriodo: Array<{
    periodo: string;
    leads: number;
    conversoes: number;
  }>;
  reunioesRealizadasCloserRanking: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    count: number;
  }>;
  reunioesRealizadasSdrRanking: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    count: number;
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
  getMetrics(supabaseId: string, teamId: string, filters?: MetricsFilters): Promise<DashboardMetricsData>;
  getDetailedMetrics(supabaseId: string, teamId: string): Promise<DetailedMetricsData[]>;
  clearCache?(supabaseId: string, teamId: string, filters?: MetricsFilters): void;
  clearDetailedCache?(supabaseId: string, teamId: string): void;
  clearAllCache?(): void;
}
