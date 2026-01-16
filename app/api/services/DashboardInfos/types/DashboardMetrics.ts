import { LeadStatus } from "@prisma/client";

export type DashboardMetrics = {
  // Métricas básicas
  agendamentos: number;
  negociacao: number;
  implementacao: number;
  vendas: number;
  
  // Métricas calculadas
  taxaConversao: number; // (vendas / agendamentos) * 100
  receitaTotal: number; // Soma de 'ticket' dos leads finalizados
  ticket: number; // Soma de 'ticket' de todos os leads (intenção de compra)
  churnRate: number; // (negada operadora / vendas) * 100
  noShowRate: number; // (NoShow / agendamentos) * 100
  cadencia: number; // Soma de 'currentValue' de todos os leads
  
  // Dados por período com conversão
  leadsPorPeriodo: {
    periodo: string;
    leads: number;
    conversoes: number;
  }[];
  
  // Dados detalhados por status
  statusCount: Record<LeadStatus, number>;
};