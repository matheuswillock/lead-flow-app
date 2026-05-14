import { LeadStatus } from "@prisma/client";

export type DashboardMetrics = {
  // Métricas básicas
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
  vendasRealizadas: number; // leads em status invoicePayment (boleto gerado, contrato pendente)
  dpsCount: number; // leads em status dps_agreement
  proposalCount: number; // leads em status offerSubmission
  convertedCount: number; // leads em invoicePayment + dps_agreement + contract_finalized
  reunioesRealizadasCloser: number;
  reunioesRealizadasSdr: number;
  
  // Métricas calculadas
  taxaConversao: number; // (vendas / agendamentos) * 100
  conversionRate: number; // (salesCount / totalLeads) * 100
  conversionRateCrm: number;
  conversionRateFinancial: number;
  receitaTotal: number; // Soma de 'ticket' dos leads finalizados
  ticket: number; // Soma de 'ticket' de todos os leads (intenção de compra)
  churnRate: number; // (perdidos + desqualificados) / total criados * 100
  churnRateCrm: number;
  churnRateFinancial: number;
  noShowRate: number; // (NoShow / agendamentos) * 100
  cadencia: number; // Soma de 'currentValue' de todos os leads
  
  // Dados por período com conversão
  leadsPorPeriodo: {
    periodo: string;
    leads: number;
    conversoes: number;
  }[];

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
  
  // Dados detalhados por status
  statusCount: Record<LeadStatus, number>;
};
