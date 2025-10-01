import { LeadStatus } from "@prisma/client";
import { metricsRepository } from "@/app/api/infra/data/repositories/metrics/MetricsRepository";
import type { MetricsFilters } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";

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
  NoShow: number; // (NoShow / agendamentos) * 100
  
  // Dados por período
  leadsPorPeriodo: {
    periodo: string;
    total: number;
  }[];
  
  // Dados detalhados por status
  statusCount: Record<LeadStatus, number>;
};

export type DashboardFilters = {
  supabaseId: string;
  startDate?: Date;
  endDate?: Date;
  period?: '7d' | '30d' | '3m' | '6m' | '1y';
};

/**
 * Status Groups para cálculo das métricas
 * 
 * Agendamentos: scheduled
 * Negociação: offerNegotiation
 * Implementação: offerSubmission + dps_agreement + invoicePayment + pending_documents
 * Vendas: contract_finalized
 * Churn: operator_denied
 */
const STATUS_GROUPS = {
  AGENDAMENTOS: ['scheduled'] as LeadStatus[],
  NEGOCIACAO: ['offerNegotiation'] as LeadStatus[],
  IMPLEMENTACAO: [
    'offerSubmission',
    'dps_agreement', 
    'invoicePayment',
    'pending_documents'
  ] as LeadStatus[],
  VENDAS: ['contract_finalized'] as LeadStatus[],
  CHURN: ['operator_denied'] as LeadStatus[],
  NO_SHOW: ['no_show'] as LeadStatus[],
} as const;

export class DashboardInfosService {
  
  /**
   * Busca todas as métricas do dashboard
   */
  static async getDashboardMetrics(filters: DashboardFilters): Promise<DashboardMetrics> {
    const { supabaseId, startDate, endDate } = filters;
    
    const repositoryFilters: MetricsFilters = {
      supabaseId,
      startDate,
      endDate,
    };

    const leads = await metricsRepository.findLeadsForMetrics(repositoryFilters);

    // Contar por status
    const statusCount = leads.reduce((acc: Record<LeadStatus, number>, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<LeadStatus, number>);

    // Preencher status faltantes com 0
    Object.values(LeadStatus).forEach(status => {
      if (!(status in statusCount)) {
        statusCount[status] = 0;
      }
    });

    const agendamentos = this.countByStatusGroup(statusCount, STATUS_GROUPS.AGENDAMENTOS);
    const negociacao = this.countByStatusGroup(statusCount, STATUS_GROUPS.NEGOCIACAO);
    const implementacao = this.countByStatusGroup(statusCount, STATUS_GROUPS.IMPLEMENTACAO);
    const vendas = this.countByStatusGroup(statusCount, STATUS_GROUPS.VENDAS);
    const churn = this.countByStatusGroup(statusCount, STATUS_GROUPS.CHURN);
    const NoShow = this.countByStatusGroup(statusCount, STATUS_GROUPS.NO_SHOW);

    const taxaConversao = agendamentos > 0 ? (vendas / agendamentos) * 100 : 0;
    const churnRate = vendas > 0 ? (churn / vendas) * 100 : 0;
    
    // Calcular receita total (apenas de vendas finalizadas)
    const receitaTotal = leads
      .filter((lead) => lead.status === 'contract_finalized' && lead.currentValue)
      .reduce((total: number, lead) => total + Number(lead.currentValue || 0), 0);

    // Dados por período
    const leadsPorPeriodo = await this.getLeadsByPeriod(filters);

    return {
      agendamentos,
      negociacao,
      implementacao,
      vendas,
      taxaConversao: Math.round(taxaConversao * 100) / 100,
      receitaTotal,
      churnRate: Math.round(churnRate * 100) / 100,
      leadsPorPeriodo,
      statusCount,
      NoShow,
    };
  }

  /**
   * Conta leads por grupo de status
   */
  private static countByStatusGroup(
    statusCount: Record<LeadStatus, number>, 
    statusGroup: readonly LeadStatus[]
  ): number {
    return statusGroup.reduce((total, status) => total + (statusCount[status] || 0), 0);
  }

  /**
   * Busca leads agrupados por período
   */
  private static async getLeadsByPeriod(filters: DashboardFilters) {
    const { supabaseId, period = '30d' } = filters;
    
    let startDate: Date;
    const endDate = new Date();
    
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '3m':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '6m':
        startDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const leads = await metricsRepository.getLeadsByPeriod(supabaseId, startDate, endDate);

    // Agrupar por dia/semana/mês dependendo do período
    const groupedData = this.groupLeadsByTimeInterval(leads, period);
    
    return groupedData.map(item => ({
      periodo: item.date,
      total: item.count,
    }));
  }

  /**
   * Agrupa leads por intervalo de tempo
   */
  private static groupLeadsByTimeInterval(
    leads: Array<{ createdAt: Date; _count: { id: number } }>,
    period: string
  ) {
    const grouped = new Map<string, number>();

    leads.forEach(lead => {
      let key: string;
      
      if (period === '7d') {
        // Agrupar por dia
        key = lead.createdAt.toISOString().split('T')[0];
      } else if (period === '30d') {
        // Agrupar por dia
        key = lead.createdAt.toISOString().split('T')[0];
      } else {
        // Agrupar por mês para períodos maiores
        const date = new Date(lead.createdAt);
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      grouped.set(key, (grouped.get(key) || 0) + lead._count.id);
    });

    return Array.from(grouped.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  /**
   * Busca métricas detalhadas por status
   */
  static async getDetailedStatusMetrics(supabaseId: string) {
    const statusMetrics = await metricsRepository.getStatusMetrics(supabaseId);

    return statusMetrics.map((metric) => ({
      status: metric.status,
      count: metric._count.id,
      averageValue: Number(metric._avg.currentValue || 0),
      totalValue: Number(metric._sum.currentValue || 0),
    }));
  }
}