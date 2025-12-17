import { LeadStatus } from "@prisma/client";
import { metricsRepository } from "@/app/api/infra/data/repositories/metrics/MetricsRepository";
import type { MetricsFilters } from "@/app/api/infra/data/repositories/metrics/IMetricsRepository";
import { IDashboardInfosService } from "./IDashboardInfosService";
import { DashboardMetrics } from "./types/DashboardMetrics";
import { DashboardFilters } from "./types/DashboardFilters";
import { DetailedStatusMetrics } from "./types/DetailedStatusMetrics";

/**
 * Status Groups for metrics calculation
 * 
 * Scheduled: scheduled
 * Negotiation: offerNegotiation + pricingRequest (Quote)
 * Implementation: offerSubmission (Proposal) + dps_agreement (DPS) + invoicePayment (Invoice) + pending_documents (Pending Documents)
 * Sales: contract_finalized
 * Churn: operator_denied (Denied by operator)
 */
const STATUS_GROUPS = {
  SCHEDULED: ['scheduled'] as LeadStatus[],
  NEGOTIATION: ['offerNegotiation', 'pricingRequest'] as LeadStatus[],
  IMPLEMENTATION: [
    'offerSubmission',    // Proposal
    'dps_agreement',      // DPS
    'invoicePayment',     // Invoice
    'pending_documents'   // Pending Documents
  ] as LeadStatus[],
  SALES: ['contract_finalized'] as LeadStatus[],
  CHURN: ['operator_denied'] as LeadStatus[],
  NO_SHOW: ['no_show'] as LeadStatus[],
} as const;

export class DashboardInfosService implements IDashboardInfosService {
  /**
   * Busca todas as métricas do dashboard
   */
 async getDashboardMetrics(filters: DashboardFilters): Promise<DashboardMetrics> {
    const { supabaseId, startDate, endDate } = filters;
    
    const repositoryFilters: MetricsFilters = {
      supabaseId,
      startDate,
      endDate,
    };

    const leads = await metricsRepository.findLeadsForMetrics(repositoryFilters);

    // Buscar agendamentos da tabela LeadsSchedule
    const scheduledLeads = await metricsRepository.getScheduledLeads(repositoryFilters);
    const agendamentos = scheduledLeads.length;

    // Buscar vendas da tabela LeadFinalized
    const finalizedLeads = await metricsRepository.getFinalizedLeads(repositoryFilters);
    const vendas = finalizedLeads.length;

    // Contar por status (para as outras métricas)
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

    const negociacao = this.countByStatusGroup(statusCount, STATUS_GROUPS.NEGOTIATION);
    const implementacao = this.countByStatusGroup(statusCount, STATUS_GROUPS.IMPLEMENTATION);
    const churn = this.countByStatusGroup(statusCount, STATUS_GROUPS.CHURN);
    const noShowCount = this.countByStatusGroup(statusCount, STATUS_GROUPS.NO_SHOW);

    const taxaConversao = agendamentos > 0 ? (vendas / agendamentos) * 100 : 0;
    const churnRate = vendas > 0 ? (churn / vendas) * 100 : 0;
    const noShowRate = agendamentos > 0 ? (noShowCount / agendamentos) * 100 : 0;
    
    // Calcular receita total a partir da tabela LeadFinalized
    const receitaTotal = finalizedLeads.reduce((total: number, sale) => 
      total + Number(sale.amount || 0), 0
    );

    // Calcular cadência: soma de todos os valores atuais dos leads
    const cadencia = leads.reduce((total: number, lead) => 
      total + Number(lead.currentValue || 0), 0
    );

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
      noShowRate: Math.round(noShowRate * 100) / 100,
      cadencia,
      leadsPorPeriodo,
      statusCount,
    };
  }

  /**
   * Conta leads por grupo de status
   */
  private countByStatusGroup(
    statusCount: Record<LeadStatus, number>, 
    statusGroup: readonly LeadStatus[]
  ): number {
    return statusGroup.reduce((total, status) => total + (statusCount[status] || 0), 0);
  }

  /**
   * Busca leads agrupados por período com dados de conversão
   */
  private async getLeadsByPeriod(filters: DashboardFilters) {
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

    // Buscar leads criados no período
    const leads = await metricsRepository.getLeadsByPeriod(supabaseId, startDate, endDate);
    
    // Buscar conversões (vendas finalizadas) no período
    const repositoryFilters: MetricsFilters = {
      supabaseId,
      startDate,
      endDate,
    };
    const finalizedLeads = await metricsRepository.getFinalizedLeads(repositoryFilters);

    // Agrupar leads por intervalo de tempo
    const groupedLeads = this.groupLeadsByTimeInterval(leads, period);
    
    // Agrupar conversões por intervalo de tempo
    const groupedConversions = this.groupConversionsByTimeInterval(finalizedLeads, period);
    
    // Combinar dados
    return groupedLeads.map(item => ({
      periodo: item.date,
      leads: item.count,
      conversoes: groupedConversions.get(item.date) || 0,
    }));
  }

  /**
   * Agrupa leads por intervalo de tempo
   */
  private groupLeadsByTimeInterval(
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
   * Agrupa conversões por intervalo de tempo
   * IMPORTANTE: Agrupa pela data de CRIAÇÃO do lead, não pela data de finalização
   */
  private groupConversionsByTimeInterval(
    conversions: Array<{ finalizedDateAt: Date; lead: { createdAt: Date } }>,
    period: string
  ): Map<string, number> {
    const grouped = new Map<string, number>();

    conversions.forEach(conversion => {
      let key: string;
      
      if (period === '7d' || period === '30d') {
        // Agrupar por dia usando a data de CRIAÇÃO do lead
        key = conversion.lead.createdAt.toISOString().split('T')[0];
      } else {
        // Agrupar por mês para períodos maiores usando a data de CRIAÇÃO do lead
        const date = new Date(conversion.lead.createdAt);
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      grouped.set(key, (grouped.get(key) || 0) + 1);
    });

    return grouped;
  }

  /**
   * Busca métricas detalhadas por status
   */
 async getDetailedStatusMetrics(supabaseId: string) : Promise<DetailedStatusMetrics[]> {
    const statusMetrics = await metricsRepository.getStatusMetrics(supabaseId);

    return statusMetrics.map((metric) => ({
      status: metric.status,
      count: metric._count.id,
      averageValue: Number(metric._avg.currentValue || 0),
      totalValue: Number(metric._sum.currentValue || 0),
    }));
  }
}
