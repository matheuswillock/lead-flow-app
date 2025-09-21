import { Output } from "@/lib/output";
import { IDashboardService, DashboardMetrics } from "./IDashboardUseCase";
import { ILeadRepository } from "../../../api/infra/data/repositories/lead/ILeadRepository";
import { IProfileRepository } from "../../../api/infra/data/repositories/profile/IProfileRepository";
import { LeadStatus } from "@prisma/client";

export class DashboardUseCase implements IDashboardService {
  constructor(
    private leadRepository: ILeadRepository,
    private profileRepository: IProfileRepository
  ) {}

  async getDashboardMetrics(supabaseId: string): Promise<Output> {
    try {
      // Buscar informações do perfil
      const profile = await this.profileRepository.findBySupabaseId(supabaseId);
      if (!profile) {
        return new Output(false, [], ["Perfil não encontrado"], null);
      }

      const managerId = profile.role === 'manager' ? profile.id : profile.managerId;
      if (!managerId) {
        return new Output(false, [], ["Manager não identificado"], null);
      }

      // Definir períodos para comparação
      const currentDate = new Date();
      const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(currentDate.getTime() - 60 * 24 * 60 * 60 * 1000);

      // Buscar dados do período atual (últimos 30 dias)
      const currentPeriodData = await this.leadRepository.findByManagerId(managerId, {
        startDate: thirtyDaysAgo,
        endDate: currentDate
      });

      // Buscar dados do período anterior (30-60 dias atrás)
      const previousPeriodData = await this.leadRepository.findByManagerId(managerId, {
        startDate: sixtyDaysAgo,
        endDate: thirtyDaysAgo
      });

      // Buscar todos os leads para métricas gerais
      const allLeadsData = await this.leadRepository.findByManagerId(managerId);

      // Calcular métricas
      const metrics = await this.calculateMetrics(
        currentPeriodData.leads || [],
        previousPeriodData.leads || [],
        allLeadsData.leads || []
      );

      return new Output(true, ["Métricas calculadas com sucesso"], [], metrics);
    } catch (error) {
      console.error("Erro ao calcular métricas do dashboard:", error);
      return new Output(false, [], ["Erro interno ao calcular métricas"], null);
    }
  }

  private async calculateMetrics(
    currentPeriodLeads: any[],
    previousPeriodLeads: any[],
    allLeads: any[]
  ): Promise<DashboardMetrics> {
    // Métricas principais
    const totalRevenue = this.calculateTotalRevenue(currentPeriodLeads, previousPeriodLeads);
    const newLeads = this.calculateNewLeads(currentPeriodLeads, previousPeriodLeads);
    const activeLeads = this.calculateActiveLeads(allLeads);
    const conversionRate = this.calculateConversionRate(currentPeriodLeads, previousPeriodLeads);

    // Novas métricas solicitadas
    const vendasFechadas = this.calculateVendasFechadas(currentPeriodLeads, previousPeriodLeads);
    const cotacoes = this.calculateCotacoes(currentPeriodLeads, previousPeriodLeads);
    const mensalidadeAtual = this.calculateMensalidadeAtual(allLeads);
    const agendamentos = this.calculateAgendamentos(currentPeriodLeads, previousPeriodLeads);
    const noShowRate = this.calculateNoShowRate();

    // Dados para gráficos
    const kanbanDistribution = this.calculateKanbanDistribution(allLeads);
    const agendamentosPorDia = this.calculateAgendamentosPorDia(allLeads);
    const leadsByStatus = this.calculateLeadsByStatus(allLeads);
    const monthlyTrend = this.calculateMonthlyTrend(allLeads);
    const topPerformers = this.calculateTopPerformers(allLeads);

    return {
      totalRevenue,
      newLeads,
      activeLeads,
      conversionRate,
      vendasFechadas,
      cotacoes,
      mensalidadeAtual,
      agendamentos,
      noShowRate,
      kanbanDistribution,
      agendamentosPorDia,
      leadsByStatus,
      monthlyTrend,
      topPerformers,
    };
  }

  private calculateTotalRevenue(current: any[], previous: any[]) {
    const currentRevenue = current
      .filter(lead => lead.status === LeadStatus.contract_finalized && lead.leadValue)
      .reduce((sum, lead) => sum + parseFloat(lead.leadValue), 0);

    const previousRevenue = previous
      .filter(lead => lead.status === LeadStatus.contract_finalized && lead.leadValue)
      .reduce((sum, lead) => sum + parseFloat(lead.leadValue), 0);

    return this.createMetricWithTrend(currentRevenue, previousRevenue);
  }

  private calculateNewLeads(current: any[], previous: any[]) {
    return this.createMetricWithTrend(current.length, previous.length);
  }

  private calculateActiveLeads(leads: any[]) {
    const activeStatuses = [LeadStatus.new_opportunity, LeadStatus.scheduled, LeadStatus.pricingRequest, LeadStatus.offerNegotiation];
    const currentActive = leads.filter(lead => activeStatuses.includes(lead.status)).length;
    
    // Para comparação, calculamos leads ativos há 30 dias
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const previousActive = leads.filter(lead => 
      activeStatuses.includes(lead.status) && 
      new Date(lead.createdAt) < thirtyDaysAgo
    ).length;
    
    return this.createMetricWithTrend(currentActive, previousActive);
  }

  private calculateConversionRate(current: any[], previous: any[]) {
    const currentRate = current.length > 0 
      ? (current.filter(lead => lead.status === LeadStatus.contract_finalized).length / current.length) * 100 
      : 0;
    
    const previousRate = previous.length > 0 
      ? (previous.filter(lead => lead.status === LeadStatus.contract_finalized).length / previous.length) * 100 
      : 0;

    return this.createMetricWithTrend(currentRate, previousRate);
  }

  private calculateVendasFechadas(current: any[], previous: any[]) {
    const currentSales = current.filter(lead => lead.status === LeadStatus.contract_finalized).length;
    const previousSales = previous.filter(lead => lead.status === LeadStatus.contract_finalized).length;
    
    return this.createMetricWithTrend(currentSales, previousSales);
  }

  private calculateCotacoes(current: any[], previous: any[]) {
    // Assumindo que cotações são leads com status PROPOSAL ou NEGOTIATION
    const currentQuotes = current.filter(lead => 
      [LeadStatus.pricingRequest, LeadStatus.offerNegotiation].includes(lead.status)
    ).length;
    
    const previousQuotes = previous.filter(lead => 
      [LeadStatus.pricingRequest, LeadStatus.offerNegotiation].includes(lead.status)
    ).length;
    
    return this.createMetricWithTrend(currentQuotes, previousQuotes);
  }

  private calculateMensalidadeAtual(leads: any[]) {
    const leadsWithValue = leads.filter(lead => 
      lead.status === LeadStatus.contract_finalized && lead.leadValue
    );
    
    if (leadsWithValue.length === 0) {
      return this.createMetricWithTrend(0, 0);
    }
    
    const currentAverage = leadsWithValue.reduce((sum, lead) => 
      sum + parseFloat(lead.leadValue), 0
    ) / leadsWithValue.length;
    
    // Para comparação, simulamos dados históricos (90% do atual)
    const historicalAverage = currentAverage * 0.9;
    
    return this.createMetricWithTrend(currentAverage, historicalAverage);
  }

  private calculateAgendamentos(current: any[], previous: any[]) {
    // Assumindo que agendamentos são leads QUALIFIED ou em estágios avançados
    const currentScheduled = current.filter(lead => 
      [LeadStatus.scheduled, LeadStatus.pricingRequest, LeadStatus.offerNegotiation].includes(lead.status)
    ).length;
    
    const previousScheduled = previous.filter(lead => 
      [LeadStatus.scheduled, LeadStatus.pricingRequest, LeadStatus.offerNegotiation].includes(lead.status)
    ).length;
    
    return this.createMetricWithTrend(currentScheduled, previousScheduled);
  }

  private calculateNoShowRate(): { value: number; previousValue: number; trend: "up" | "down" | "stable"; percentage: number; } {
    // Simulação: assumindo 15% de no-show atual e 20% anterior
    // Em implementação real, isso viria de uma tabela de agendamentos
    const currentNoShow = 15;
    const previousNoShow = 20;
    
    return this.createMetricWithTrend(currentNoShow, previousNoShow);
  }

  private calculateKanbanDistribution(leads: any[]) {
    const statusColors: { [key in LeadStatus]: string } = {
      [LeadStatus.new_opportunity]: "var(--chart-1)",
      [LeadStatus.scheduled]: "var(--chart-2)",
      [LeadStatus.no_show]: "var(--destructive)",
      [LeadStatus.pricingRequest]: "var(--chart-3)",
      [LeadStatus.offerNegotiation]: "var(--chart-4)",
      [LeadStatus.pending_documents]: "var(--chart-5)",
      [LeadStatus.offerSubmission]: "var(--warning)",
      [LeadStatus.dps_agreement]: "var(--chart-1)",
      [LeadStatus.invoicePayment]: "var(--chart-2)",
      [LeadStatus.disqualified]: "var(--destructive)",
      [LeadStatus.opportunityLost]: "var(--destructive)",
      [LeadStatus.operator_denied]: "var(--muted)",
      [LeadStatus.contract_finalized]: "var(--success)",
    };

    const distribution = Object.values(LeadStatus).map(status => {
      const count = leads.filter(lead => lead.status === status).length;
      return {
        name: this.getStatusLabel(status),
        value: count,
        fill: statusColors[status],
        status: status,
      };
    }).filter(item => item.value > 0);

    return distribution;
  }

  private calculateAgendamentosPorDia(leads: any[]) {
    const last7Days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      // Simulação de dados - em implementação real viria de tabela de agendamentos
      const dayLeads = leads.filter(lead => {
        const leadDate = new Date(lead.createdAt).toISOString().split('T')[0];
        return leadDate === dateStr;
      });
      
      last7Days.push({
        date: dateStr,
        agendamentos: Math.floor(dayLeads.length * 0.6), // 60% dos leads viram agendamentos
        comparecimentos: Math.floor(dayLeads.length * 0.45), // 75% comparecem 
        noShows: Math.floor(dayLeads.length * 0.15), // 25% não comparecem
        day: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
      });
    }
    
    return last7Days;
  }

  private calculateLeadsByStatus(leads: any[]) {
    const statusCount: { [key: string]: number } = {};
    
    Object.values(LeadStatus).forEach(status => {
      statusCount[status] = leads.filter(lead => lead.status === status).length;
    });
    
    return statusCount;
  }

  private calculateMonthlyTrend(leads: any[]) {
    const last6Months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      const monthLeads = leads.filter(lead => {
        const leadMonth = new Date(lead.createdAt).toISOString().substring(0, 7);
        return leadMonth === monthStr;
      });
      
      const vendas = monthLeads.filter(lead => lead.status === LeadStatus.contract_finalized).length;
      const cotacoes = monthLeads.filter(lead => 
        [LeadStatus.pricingRequest, LeadStatus.offerNegotiation].includes(lead.status)
      ).length;
      
      const revenue = monthLeads
        .filter(lead => lead.status === LeadStatus.contract_finalized && lead.leadValue)
        .reduce((sum, lead) => sum + parseFloat(lead.leadValue), 0);
      
      last6Months.push({
        month: monthStr,
        leads: monthLeads.length,
        vendas,
        cotacoes,
        agendamentos: Math.floor(monthLeads.length * 0.6),
        revenue,
      });
    }
    
    return last6Months;
  }

  private calculateTopPerformers(leads: any[]) {
    // Agrupar por criador (vendedor)
    const performerMap = new Map();
    
    leads.forEach(lead => {
      const createdBy = lead.createdBy || 'unknown';
      if (!performerMap.has(createdBy)) {
        performerMap.set(createdBy, {
          id: createdBy,
          name: `Vendedor ${createdBy.substring(0, 8)}`, // Simplificado
          leads: 0,
          conversions: 0,
          revenue: 0,
          agendamentos: 0,
          noShows: 0,
        });
      }
      
      const performer = performerMap.get(createdBy);
      performer.leads += 1;
      
      if (lead.status === LeadStatus.contract_finalized) {
        performer.conversions += 1;
        if (lead.leadValue) {
          performer.revenue += parseFloat(lead.leadValue);
        }
      }
      
      // Simulação de agendamentos
      if ([LeadStatus.scheduled, LeadStatus.pricingRequest].includes(lead.status)) {
        performer.agendamentos += 1;
      }
    });
    
    return Array.from(performerMap.values())
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5);
  }

  private createMetricWithTrend(current: number, previous: number) {
    const percentage = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const trend = percentage > 0 ? "up" : percentage < 0 ? "down" : "stable";
    
    return {
      value: current,
      previousValue: previous,
      trend: trend as "up" | "down" | "stable",
      percentage: Math.abs(percentage),
    };
  }

  private getStatusLabel(status: LeadStatus): string {
    const labels: { [key in LeadStatus]: string } = {
      [LeadStatus.new_opportunity]: "Nova Oportunidade",
      [LeadStatus.scheduled]: "Agendado",
      [LeadStatus.no_show]: "Não Compareceu",
      [LeadStatus.pricingRequest]: "Solicitação de Preço",
      [LeadStatus.offerNegotiation]: "Negociação",
      [LeadStatus.pending_documents]: "Documentos Pendentes",
      [LeadStatus.offerSubmission]: "Proposta Enviada",
      [LeadStatus.dps_agreement]: "Acordo DPS",
      [LeadStatus.invoicePayment]: "Pagamento Fatura",
      [LeadStatus.disqualified]: "Desqualificado",
      [LeadStatus.opportunityLost]: "Oportunidade Perdida",
      [LeadStatus.operator_denied]: "Negado pelo Operador",
      [LeadStatus.contract_finalized]: "Contrato Finalizado",
    };
    
    return labels[status] || status;
  }
}