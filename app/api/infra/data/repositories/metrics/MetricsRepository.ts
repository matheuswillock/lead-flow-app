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
    const { supabaseId, startDate, endDate } = filters;
    
    const whereClause = {
      manager: {
        supabaseId: supabaseId,
      },
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
  async getStatusMetrics(supabaseId: string): Promise<StatusMetricsData[]> {
    const results = await prisma.lead.groupBy({
      by: ['status'],
      where: { 
        manager: {
          supabaseId: supabaseId,
        }
      },
      _count: {
        _all: true,
      },
      _avg: {
        currentValue: true,
      },
      _sum: {
        currentValue: true,
      },
    });

    return results.map(result => ({
      status: result.status,
      _count: {
        id: result._count._all,
      },
      _avg: result._avg,
      _sum: result._sum,
    }));
  }

  /**
   * Busca leads agrupados por período
   */
  async getLeadsByPeriod(supabaseId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]> {
    const results = await prisma.lead.groupBy({
      by: ['createdAt'],
      where: {
        manager: {
          supabaseId: supabaseId,
        },
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        _all: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return results.map(result => ({
      createdAt: result.createdAt,
      _count: {
        id: result._count._all,
      },
    }));
  }
}

// Instância única para uso em toda aplicação
export const metricsRepository = new MetricsRepository();