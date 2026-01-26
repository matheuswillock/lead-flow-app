import { LeadStatus } from "@prisma/client";

export interface LeadMetricsData {
  id: string;
  status: LeadStatus;
  currentValue: any; // Prisma Decimal type
  ticket: any; // Prisma Decimal type
  createdAt: Date;
}

export interface StatusMetricsData {
  status: LeadStatus;
  _count: {
    id: number;
  };
  _avg: {
    currentValue: any; // Prisma Decimal type
  };
  _sum: {
    currentValue: any; // Prisma Decimal type
  };
}

export interface LeadsPeriodData {
  createdAt: Date;
  _count: {
    id: number;
  };
}

export interface MetricsFilters {
  supabaseId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface ScheduleMetricsData {
  id: string;
  leadId: string;
  date: Date;
  createdAt: Date;
}

export interface SaleMetricsData {
  id: string;
  leadId: string;
  amount: any; // Prisma Decimal type
  finalizedDateAt: Date;
  lead: {
    createdAt: Date;
  };
}

export interface IMetricsRepository {
  /**
   * Busca leads básicos para cálculo de métricas
   */
  findLeadsForMetrics(filters: MetricsFilters): Promise<LeadMetricsData[]>;

  /**
   * Busca métricas detalhadas por status
   */
  getStatusMetrics(supabaseId: string): Promise<StatusMetricsData[]>;

  /**
   * Busca leads agrupados por período
   */
  getLeadsByPeriod(supabaseId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]>;

  /**
   * Busca agendamentos da tabela LeadsSchedule
   */
  getScheduledLeads(filters: MetricsFilters): Promise<ScheduleMetricsData[]>;

  /**
   * Busca vendas finalizadas da tabela LeadFinalized
   */
  getFinalizedLeads(filters: MetricsFilters): Promise<SaleMetricsData[]>;
}