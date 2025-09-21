import { Output } from "@/lib/output";

export interface DashboardMetrics {
  // Métricas Principais
  totalRevenue: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };
  newLeads: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };
  activeLeads: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };
  conversionRate: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };

  // Novas Métricas Solicitadas
  vendasFechadas: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };
  cotacoes: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };
  mensalidadeAtual: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };
  agendamentos: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };
  noShowRate: {
    value: number;
    previousValue: number;
    trend: "up" | "down" | "stable";
    percentage: number;
  };

  // Dados para Gráficos
  kanbanDistribution: {
    name: string;
    value: number;
    fill: string;
    status: string;
  }[];
  agendamentosPorDia: {
    date: string;
    agendamentos: number;
    comparecimentos: number;
    noShows: number;
    day: string;
  }[];
  leadsByStatus: {
    [key: string]: number;
  };
  monthlyTrend: {
    month: string;
    leads: number;
    vendas: number;
    cotacoes: number;
    agendamentos: number;
    revenue: number;
  }[];
  topPerformers: {
    id: string;
    name: string;
    leads: number;
    conversions: number;
    revenue: number;
    agendamentos: number;
    noShows: number;
  }[];
}

export interface IDashboardService {
  getDashboardMetrics(supabaseId: string): Promise<Output>;
}