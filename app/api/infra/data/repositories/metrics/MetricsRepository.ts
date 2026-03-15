import { prisma } from "@/app/api/infra/data/prisma";
import { isManagerLikeRole } from "@/lib/roles";
import type { 
  IMetricsRepository, 
  LeadMetricsData, 
  StatusMetricsData, 
  LeadsPeriodData,
  MetricsFilters,
  ScheduleMetricsData,
  MeetingHeldLeadMetricsData,
  SaleMetricsData
} from "./IMetricsRepository";

export class MetricsRepository implements IMetricsRepository {
  private async getTeamContext(supabaseId: string, teamId: string) {
    const profile = await prisma.profile.findUnique({
      where: { supabaseId },
      select: { id: true },
    });

    if (!profile) {
      throw new Error("Profile não encontrado");
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId: profile.id,
        },
      },
      select: { role: true, functions: true },
    });

    if (!teamMember) {
      throw new Error("Acesso negado para este time");
    }

    if (
      teamMember.role === "operator" &&
      !teamMember.functions.includes("SDR") &&
      !teamMember.functions.includes("CLOSER")
    ) {
      throw new Error("Acesso negado: função SDR ou CLOSER necessária para visualizar leads.");
    }

    return { profileId: profile.id, teamMember };
  }
  
  /**
   * Busca leads básicos para cálculo de métricas
   * - Se supabaseId for de um Manager master: busca leads do manager + operators dele
   * - Se supabaseId for de um Manager não-master: busca leads do master (todos da equipe)
   * - Se supabaseId for de um Operator: busca apenas os leads do operator
   */
  async findLeadsForMetrics(filters: MetricsFilters): Promise<LeadMetricsData[]> {
    const { supabaseId, teamId, startDate, endDate } = filters;
    const { profileId, teamMember } = await this.getTeamContext(supabaseId, teamId);

    // Construir where clause baseado na role
    let whereClause: any;

    if (isManagerLikeRole(teamMember.role)) {
      // Manager: buscar leads do time
      whereClause = {
        teamId,
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    } else {
      // Operator: buscar apenas leads atribuídos a ele OU criados por ele
      whereClause = {
        OR: [
          { assignedTo: profileId },
          { createdBy: profileId }
        ],
        teamId,
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
        ticket: true,
        createdAt: true,
        meetingHeald: true,
        assignedTo: true,
        closerId: true,
      },
    });
  }

  /**
   * Busca métricas detalhadas por status
   * - Se supabaseId for de um Manager master: busca leads do manager + operators dele
   * - Se supabaseId for de um Manager não-master: busca leads do master (todos da equipe)
   * - Se supabaseId for de um Operator: busca apenas os leads do operator
   */
  async getStatusMetrics(supabaseId: string, teamId: string): Promise<StatusMetricsData[]> {
    const { profileId, teamMember } = await this.getTeamContext(supabaseId, teamId);

    // Construir where clause baseado na role
    let whereClause: any;

    if (isManagerLikeRole(teamMember.role)) {
      // Manager: buscar leads do time
      whereClause = {
        teamId,
      };
    } else {
      // Operator: buscar apenas leads atribuídos a ele OU criados por ele
      whereClause = {
        OR: [
          { assignedTo: profileId },
          { createdBy: profileId }
        ],
        teamId,
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
   * - Se supabaseId for de um Manager master: busca leads do manager + operators dele
   * - Se supabaseId for de um Manager não-master: busca leads do master (todos da equipe)
   * - Se supabaseId for de um Operator: busca apenas os leads do operator
   */
  async getLeadsByPeriod(supabaseId: string, teamId: string, startDate: Date, endDate: Date): Promise<LeadsPeriodData[]> {
    const { profileId, teamMember } = await this.getTeamContext(supabaseId, teamId);

    // Construir where clause baseado na role
    let whereClause: any;

    if (isManagerLikeRole(teamMember.role)) {
      // Manager: buscar leads do time
      whereClause = {
        teamId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      };
    } else {
      // Operator: buscar apenas leads atribuídos a ele OU criados por ele
      whereClause = {
        OR: [
          { assignedTo: profileId },
          { createdBy: profileId }
        ],
        teamId,
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
   * - Se supabaseId for de um Manager master: busca agendamentos do manager + operators dele
   * - Se supabaseId for de um Manager não-master: busca agendamentos do master (todos da equipe)
   * - Se supabaseId for de um Operator: busca apenas agendamentos do operator
   */
  async getScheduledLeads(filters: MetricsFilters): Promise<ScheduleMetricsData[]> {
    const { supabaseId, teamId, startDate, endDate } = filters;
    const { profileId, teamMember } = await this.getTeamContext(supabaseId, teamId);

    // Construir where clause baseado na role
    let whereClause: any;

    if (isManagerLikeRole(teamMember.role)) {
      // Manager: buscar agendamentos do time
      whereClause = {
        lead: {
          teamId,
        },
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    } else {
      // Operator: buscar apenas agendamentos atribuídos a ele OU criados por ele
      whereClause = {
        lead: {
          OR: [
            { assignedTo: profileId },
            { createdBy: profileId }
          ],
          teamId,
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
   * - Se supabaseId for de um Manager master: busca vendas do manager + operators dele
   * - Se supabaseId for de um Manager não-master: busca vendas do master (todos da equipe)
   * - Se supabaseId for de um Operator: busca apenas vendas do operator
   */
  async getFinalizedLeads(filters: MetricsFilters): Promise<SaleMetricsData[]> {
    const { supabaseId, teamId, startDate, endDate } = filters;
    const { profileId, teamMember } = await this.getTeamContext(supabaseId, teamId);

    // Construir where clause baseado na role
    let whereClause: any;

    if (isManagerLikeRole(teamMember.role)) {
      // Manager: buscar vendas do time
      whereClause = {
        lead: {
          teamId,
        },
        ...(startDate && endDate && {
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    } else {
      // Operator: buscar apenas vendas atribuídas a ele OU criadas por ele
      whereClause = {
        lead: {
          OR: [
            { assignedTo: profileId },
            { createdBy: profileId }
          ],
          teamId,
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
        lead: {
          select: {
            createdAt: true,
          },
        },
      },
    });
  }

  async getMeetingsHeldLeads(filters: MetricsFilters): Promise<MeetingHeldLeadMetricsData[]> {
    const { supabaseId, teamId, startDate, endDate } = filters;
    const { profileId, teamMember } = await this.getTeamContext(supabaseId, teamId);

    let whereClause: any;

    if (isManagerLikeRole(teamMember.role)) {
      whereClause = {
        teamId,
        meetingHeald: 'yes',
        ...(startDate && endDate && {
          meetingDate: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    } else {
      whereClause = {
        teamId,
        meetingHeald: 'yes',
        OR: [
          { assignedTo: profileId },
          { createdBy: profileId },
          { closerId: profileId },
        ],
        ...(startDate && endDate && {
          meetingDate: {
            gte: startDate,
            lte: endDate,
          },
        }),
      };
    }

    return await prisma.lead.findMany({
      where: whereClause,
      select: {
        meetingDate: true,
        assignedTo: true,
        closerId: true,
      },
    });
  }
}

// Instância única para uso em toda aplicação
export const metricsRepository = new MetricsRepository();
