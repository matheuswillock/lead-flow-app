import { prisma } from "@/app/api/infra/data/prisma";
import type { 
  IMetricsRepository, 
  LeadMetricsData, 
  StatusMetricsData, 
  LeadsPeriodData,
  MetricsFilters 
} from "./IMetricsRepository";

export class MetricsRepository implements IMetricsRepository {
  
  /**
   * Busca leads básicos para cálculo de métricas
   */
  async findLeadsForMetrics(filters: MetricsFilters): Promise<LeadMetricsData[]> {
    const { managerId, startDate, endDate } = filters;
    
    const whereClause = {
      managerId,
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    return await prisma.lead.findMany({
      where: whereClause,
      select: {
        id: true,
        status: true,
        currentValue: true,
        createdAt: true,
      },
    });
  }

  /**
   * Busca métricas detalhadas por status
   */
  async getStatusMetrics(managerId: string): Promise<StatusMetricsData[]> {
    const results = await prisma.lead.groupBy({
      by: ['status'],
      where: { managerId },
      _count: {
        id: true,
      },
      _avg: {
        currentValue: true,
      },
      _sum: {
        currentValue: true,
      },
    });

    return results as StatusMetricsData[];
  }

  /**
   * Busca leads agrupados por período
   */
  async getLeadsByPeriod(managerId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]> {
    const results = await prisma.lead.groupBy({
      by: ['createdAt'],
      where: {
        managerId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return results as LeadsPeriodData[];
  }
}

// Instância única para uso em toda aplicação
export const metricsRepository = new MetricsRepository();