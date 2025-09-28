import { LeadStatus } from "@prisma/client";

export interface LeadMetricsData {
  id: string;
  status: LeadStatus;
  currentValue: any; // Prisma Decimal type
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
  managerId: string;
  startDate?: Date;
  endDate?: Date;
}

export interface IMetricsRepository {
  /**
   * Busca leads básicos para cálculo de métricas
   */
  findLeadsForMetrics(filters: MetricsFilters): Promise<LeadMetricsData[]>;

  /**
   * Busca métricas detalhadas por status
   */
  getStatusMetrics(managerId: string): Promise<StatusMetricsData[]>;

  /**
   * Busca leads agrupados por período
   */
  getLeadsByPeriod(managerId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]>;
}