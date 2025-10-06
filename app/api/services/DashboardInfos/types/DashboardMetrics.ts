import { LeadStatus } from "@prisma/client";

export type DashboardMetrics = {
  // Métricas básicas
  agendamentos: number;
  negociacao: number;
  implementacao: number;
  vendas: number;
  
  // Métricas calculadas
  taxaConversao: number; // (vendas / agendamentos) * 100
  receitaTotal: number;
  churnRate: number; // (negada operadora / vendas) * 100
  noShowRate: number; // (NoShow / agendamentos) * 100
  
  // Dados por período com conversão
  leadsPorPeriodo: {
    periodo: string;
    leads: number;
    conversoes: number;
  }[];
  
  // Dados detalhados por status
  statusCount: Record<LeadStatus, number>;
};