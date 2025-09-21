/**
 * Tipos do Dashboard seguindo Clean Architecture
 */

export interface DashboardMetrics {
  // Métricas Existentes
  totalRevenue: MetricWithTrend;
  newLeads: MetricWithTrend;
  activeLeads: MetricWithTrend;
  conversionRate: MetricWithTrend;
  
  // Novas Métricas Solicitadas
  vendasFechadas: MetricWithTrend;          // vendas feitas
  cotacoes: MetricWithTrend;                // cotações
  mensalidadeAtual: MetricWithTrend;        // mensalidade atual do cliente
  agendamentos: MetricWithTrend;            // qtd agendamentos
  noShowRate: MetricWithTrend;              // % no show (total de no show / agendamentos)
  
  // Dados para Gráficos
  kanbanDistribution: PieChartData[];       // Pizza (Kanban)
  agendamentosPorDia: BarChartData[];       // Barra agendamento/dia
  leadsByStatus: StatusDistribution;
  monthlyTrend: MonthlyTrendData[];
  topPerformers: PerformerData[];
}

export interface MetricWithTrend {
  value: number;
  previousValue: number;
  trend: "up" | "down" | "stable";
  percentage: number;
  label?: string;
  format?: "currency" | "number" | "percentage";
}

export interface PieChartData {
  name: string;
  value: number;
  fill: string;
  status: string;
}

export interface BarChartData {
  date: string;                    // Format: YYYY-MM-DD
  agendamentos: number;
  comparecimentos: number;
  noShows: number;
  day?: string;                    // Nome do dia da semana
}

export interface StatusDistribution {
  [key: string]: number;
}

export interface MonthlyTrendData {
  month: string;                   // Format: YYYY-MM
  leads: number;
  vendas: number;
  cotacoes: number;
  agendamentos: number;
  revenue: number;
}

export interface PerformerData {
  id: string;
  name: string;
  leads: number;
  conversions: number;
  revenue: number;
  agendamentos: number;
  noShows: number;
}

// Estados do Dashboard
export interface DashboardState {
  metrics: DashboardMetrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  selectedPeriod: TimePeriod;
}

export type TimePeriod = "7d" | "30d" | "90d" | "12m";

export interface DashboardFilters {
  period: TimePeriod;
  status?: string[];
  performer?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Props dos Componentes
export interface DashboardContainerProps {
  supabaseId: string;
}

export interface MetricCardProps {
  title: string;
  metric: MetricWithTrend;
  icon?: React.ComponentType<any>;
  className?: string;
}

export interface PieChartComponentProps {
  data: PieChartData[];
  title: string;
  className?: string;
}

export interface BarChartComponentProps {
  data: BarChartData[];
  title: string;
  className?: string;
}

// Erros e Loading
export interface DashboardError {
  code: string;
  message: string;
  details?: any;
}

export interface LoadingState {
  metrics: boolean;
  charts: boolean;
  filters: boolean;
}