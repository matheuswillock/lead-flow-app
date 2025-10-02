import { prisma } from "@/app/api/infra/data/prisma";
import type { 
  IMetricsRepository, 
  LeadMetricsData, 
  StatusMetricsData, 
  LeadsPeriodData,
  MetricsFilters,
  ScheduleMetricsData,
  SaleMetricsData
} from "./IMetricsRepository";

export class MetricsRepository implements IMetricsRepository {
  
  /**
   * Busca leads básicos para cálculo de métricas
   * - Se supabaseId for de um Manager: busca leads do manager + operators dele
   * - Se supabaseId for de um Operator: busca apenas os leads do operator
   */
  async findLeadsForMetrics(filters: MetricsFilters): Promise<LeadMetricsData[]> {
    const { supabaseId, startDate, endDate } = filters;
    
    // Buscar o perfil para verificar se é Manager ou Operator
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { 
        id: true, 
        role: true,
        operators: {
          select: { id: true }
        }
      },
    });

    if (!profile) {
      throw new Error('Profile não encontrado');
    }

    // Construir where clause baseado na role
    let whereClause: any;

    if (profile.role === 'manager') {
      // Manager: buscar leads do manager E de seus operators
      const operatorIds = profile.operators.map(op => op.id);
      whereClause = {
        OR: [
          { managerId: profile.id },
          { assignedTo: { in: operatorIds } }
        ],
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    } else {
      // Operator: buscar apenas leads atribuídos a ele
      whereClause = {
        assignedTo: profile.id,
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    }

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
   * - Se supabaseId for de um Manager: busca leads do manager + operators dele
   * - Se supabaseId for de um Operator: busca apenas os leads do operator
   */
  async getStatusMetrics(supabaseId: string): Promise<StatusMetricsData[]> {
    // Buscar o perfil para verificar se é Manager ou Operator
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { 
        id: true, 
        role: true,
        operators: {
          select: { id: true }
        }
      },
    });

    if (!profile) {
      throw new Error('Profile não encontrado');
    }

    // Construir where clause baseado na role
    let whereClause: any;

    if (profile.role === 'manager') {
      // Manager: buscar leads do manager E de seus operators
      const operatorIds = profile.operators.map(op => op.id);
      whereClause = {
        OR: [
          { managerId: profile.id },
          { assignedTo: { in: operatorIds } }
        ],
      };
    } else {
      // Operator: buscar apenas leads atribuídos a ele
      whereClause = {
        assignedTo: profile.id,
      };
    }

    const results = await prisma.lead.groupBy({
      by: ['status'],
      where: whereClause,
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
   * - Se supabaseId for de um Manager: busca leads do manager + operators dele
   * - Se supabaseId for de um Operator: busca apenas os leads do operator
   */
  async getLeadsByPeriod(supabaseId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]> {
    // Buscar o perfil para verificar se é Manager ou Operator
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { 
        id: true, 
        role: true,
        operators: {
          select: { id: true }
        }
      },
    });

    if (!profile) {
      throw new Error('Profile não encontrado');
    }

    // Construir where clause baseado na role
    let whereClause: any;

    if (profile.role === 'manager') {
      // Manager: buscar leads do manager E de seus operators
      const operatorIds = profile.operators.map(op => op.id);
      whereClause = {
        OR: [
          { managerId: profile.id },
          { assignedTo: { in: operatorIds } }
        ],
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };
    } else {
      // Operator: buscar apenas leads atribuídos a ele
      whereClause = {
        assignedTo: profile.id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };
    }

    const results = await prisma.lead.groupBy({
      by: ['createdAt'],
      where: whereClause,
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

  /**
   * Busca agendamentos da tabela LeadsSchedule
   * - Se supabaseId for de um Manager: busca agendamentos do manager + operators dele
   * - Se supabaseId for de um Operator: busca apenas agendamentos do operator
   */
  async getScheduledLeads(filters: MetricsFilters): Promise<ScheduleMetricsData[]> {
    const { supabaseId, startDate, endDate } = filters;
    
    // Buscar o perfil para verificar se é Manager ou Operator
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { 
        id: true, 
        role: true,
        operators: {
          select: { id: true }
        }
      },
    });

    if (!profile) {
      throw new Error('Profile não encontrado');
    }

    // Construir where clause baseado na role
    let whereClause: any;

    if (profile.role === 'manager') {
      // Manager: buscar agendamentos do manager E de seus operators
      const operatorIds = profile.operators.map(op => op.id);
      whereClause = {
        lead: {
          OR: [
            { managerId: profile.id },
            { assignedTo: { in: operatorIds } }
          ],
        },
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    } else {
      // Operator: buscar apenas agendamentos atribuídos a ele
      whereClause = {
        lead: {
          assignedTo: profile.id,
        },
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    }

    return await prisma.leadsSchedule.findMany({
      where: whereClause,
      select: {
        id: true,
        leadId: true,
        date: true,
        createdAt: true,
      },
    });
  }

  /**
   * Busca vendas finalizadas da tabela LeadFinalized
   * - Se supabaseId for de um Manager: busca vendas do manager + operators dele
   * - Se supabaseId for de um Operator: busca apenas vendas do operator
   */
  async getFinalizedLeads(filters: MetricsFilters): Promise<SaleMetricsData[]> {
    const { supabaseId, startDate, endDate } = filters;
    
    // Buscar o perfil para verificar se é Manager ou Operator
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { 
        id: true, 
        role: true,
        operators: {
          select: { id: true }
        }
      },
    });

    if (!profile) {
      throw new Error('Profile não encontrado');
    }

    // Construir where clause baseado na role
    let whereClause: any;

    if (profile.role === 'manager') {
      // Manager: buscar vendas do manager E de seus operators
      const operatorIds = profile.operators.map(op => op.id);
      whereClause = {
        lead: {
          OR: [
            { managerId: profile.id },
            { assignedTo: { in: operatorIds } }
          ],
        },
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    } else {
      // Operator: buscar apenas vendas atribuídas a ele
      whereClause = {
        lead: {
          assignedTo: profile.id,
        },
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    }

    return await prisma.leadFinalized.findMany({
      where: whereClause,
      select: {
        id: true,
        leadId: true,
        amount: true,
        finalizedDateAt: true,
        startDateAt: true,
        duration: true,
      },
    });
  }
}

// Instância única para uso em toda aplicação
export const metricsRepository = new MetricsRepository();