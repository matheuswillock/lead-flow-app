import { useState, useEffect } from "react";
import { Output } from "@/lib/output";

export interface DashboardMetrics {
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
  // Novas métricas
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
  // Dados para gráficos
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

export class DashboardService implements IDashboardService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  }

  async getDashboardMetrics(supabaseId: string): Promise<Output> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/dashboard/${supabaseId}/metrics`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-supabase-user-id": supabaseId,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data as Output;
    } catch (error) {
      console.error("Erro ao buscar métricas do dashboard:", error);
      return new Output(
        false,
        [],
        ["Erro ao carregar dados do dashboard. Tente novamente mais tarde."],
        null
      );
    }
  }
}

// Hook personalizado para usar o dashboard
export function useDashboard(supabaseId: string | null) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboardService] = useState(() => new DashboardService());

  const loadMetrics = async () => {
    if (!supabaseId) {
      setError("ID do usuário não fornecido");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await dashboardService.getDashboardMetrics(supabaseId);
      
      if (result.isValid && result.result) {
        setMetrics(result.result);
      } else {
        setError(result.errorMessages?.join(", ") || "Erro ao carregar métricas");
      }
    } catch (err) {
      setError("Erro inesperado ao carregar dashboard");
      console.error("Erro no hook useDashboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (supabaseId) {
      loadMetrics();
    }
  }, [supabaseId]);

  return {
    metrics,
    isLoading,
    error,
    refreshMetrics: loadMetrics,
  };
}