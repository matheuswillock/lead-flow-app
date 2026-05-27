import { ILeadRepository } from "./ILeadRepository";
import { Lead, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import type { LeadCloserForCalendar, LeadForAttendeesRoleMap } from "@/app/api/v1/leads/[id]/schedule/attendees/ScheduleAttendeesTypes";

export class LeadRepository implements ILeadRepository {
  async create(data: Prisma.LeadCreateInput): Promise<Lead> {
    return await prisma.lead.create({
      data,
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });
  }

  async findById(id: string): Promise<Lead | null> {
    return await prisma.lead.findUnique({
      where: { id },
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        activities: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                email: true,
                profileIconUrl: true,
              },
            },
            reactions: {
              select: {
                emoji: true,
                emojiUnified: true,
                profileId: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });
  }

  async findByLeadCode(leadCode: string): Promise<Lead | null> {
    return await prisma.lead.findUnique({
      where: { leadCode },
    });
  }

  async findByManagerId(
    managerId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      page?: number;
      limit?: number;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ leads: Lead[]; total: number }> {
    const {
      status,
      assignedTo,
      page = 1,
      limit = 10,
      search,
      startDate,
      endDate,
    } = options || {};

    const where: Prisma.LeadWhereInput = {
      managerId,
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(search && {
        OR: [
          { leadCode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          manager: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
          assignee: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileIconUrl: true,
            },
          },
          _count: {
            select: {
              attachments: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return { leads, total };
  }

  async update(id: string, data: Prisma.LeadUpdateInput): Promise<Lead> {
    return await prisma.lead.update({
      where: { id },
      data,
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.lead.delete({
      where: { id },
    });
  }

  async updateStatus(id: string, status: LeadStatus, extraData?: Prisma.LeadUpdateInput): Promise<Lead> {
    return await prisma.lead.update({
      where: { id },
      data: {
        status,
        ...(extraData ?? {}),
      },
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });
  }

  async assignToOperator(id: string, operatorId: string): Promise<Lead> {
    return await prisma.lead.update({
      where: { id },
      data: { assignedTo: operatorId },
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
    });
  }

  async getLeadsByStatus(managerId: string, status: LeadStatus): Promise<Lead[]> {
    return await prisma.lead.findMany({
      where: {
        managerId,
        status,
      },
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async transferToManager(id: string, newManagerId: string, reason?: string): Promise<Lead> {
    return await prisma.lead.update({
      where: { id },
      data: {
        managerId: newManagerId,
        updatedAt: new Date(),
        activities: {
          create: {
            type: 'status_change',
            body: reason || 'Lead transferido para novo gestor',
            createdAt: new Date(),
          },
        },
      },
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        activities: {
          include: {
            author: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async findAllByManagerId(
    managerId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
    } = options || {};

    const where: any = {
      managerId,
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(search && {
        OR: [
          { leadCode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const leads = await prisma.lead.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { leads };
  }

  async findAllByTeamId(
    teamId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
    } = options || {};

    const where: any = {
      teamId,
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(search && {
        OR: [
          { leadCode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const leads = await prisma.lead.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { leads };
  }

  async findAllByOperatorId(
    operatorId: string,
    options?: {
      status?: LeadStatus;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      search,
      startDate,
      endDate,
    } = options || {};

    const where: Prisma.LeadWhereInput = {
      OR: [
        { assignedTo: operatorId }, // Leads atribuídos ao operator
        { createdBy: operatorId },   // Leads criados pelo operator
      ],
      ...(status && { status }),
      ...(search && {
        OR: [
          { leadCode: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(startDate && endDate && {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      }),
    };

    const leads = await prisma.lead.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { leads };
  }

  async findAllByOperatorIdInTeam(
    operatorId: string,
    teamId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
    } = options || {};

    const filters: Prisma.LeadWhereInput[] = [];

    if (status) {
      filters.push({ status });
    }

    if (assignedTo) {
      filters.push({ assignedTo });
    }

    if (search) {
      filters.push({
        OR: [
          { leadCode: { contains: search, mode: "insensitive" } },
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    if (startDate && endDate) {
      filters.push({
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      });
    }

    const visibilityFilter: Prisma.LeadWhereInput = {
      OR: [
        {
          AND: [{ assignedTo: null }, { closerId: null }],
        },
        { assignedTo: operatorId },
        { closerId: operatorId },
      ],
    };

    const where: Prisma.LeadWhereInput = {
      teamId,
      AND: [visibilityFilter, ...filters],
    };

    const leads = await prisma.lead.findMany({
      where,
      include: {
        manager: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        assignee: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        closer: {
          select: {
            id: true,
            fullName: true,
            email: true,
            profileIconUrl: true,
          },
        },
        _count: {
          select: {
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { leads };
  }

  async reassignLeadsToMaster(deletedUserId: string, masterId: string): Promise<number> {
    // Atualizar todos os leads onde o usuário deletado é o assignedTo
    const resultAssigned = await prisma.lead.updateMany({
      where: {
        assignedTo: deletedUserId,
      },
      data: {
        assignedTo: masterId,
      },
    });

    // Atualizar todos os leads onde o usuário deletado é o createdBy
    // (não mudamos o createdBy, mas reatribuímos o assignedTo se estiver null ou for o próprio deletado)
    const resultCreated = await prisma.lead.updateMany({
      where: {
        createdBy: deletedUserId,
        OR: [
          { assignedTo: null },
          { assignedTo: deletedUserId },
        ],
      },
      data: {
        assignedTo: masterId,
      },
    });

    return resultAssigned.count + resultCreated.count;
  }

  async findCloserForCalendar(leadId: string): Promise<LeadCloserForCalendar | null> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        closer: {
          select: {
            id: true,
            supabaseId: true,
            fullName: true,
            email: true,
            googleConnection: {
              select: {
                accessToken: true,
                refreshToken: true,
                tokenExpiresAt: true,
                revokedAt: true,
              },
            },
          },
        },
      },
    });

    const c = lead?.closer;
    if (!c?.supabaseId) return null;
    return {
      id: c.id,
      supabaseId: c.supabaseId,
      fullName: c.fullName,
      email: c.email,
      googleCalendarConnected: !!c.googleConnection?.refreshToken && !c.googleConnection?.revokedAt,
      googleRefreshToken: c.googleConnection?.refreshToken ?? null,
      googleAccessToken: c.googleConnection?.accessToken ?? null,
      googleTokenExpiresAt: c.googleConnection?.tokenExpiresAt ?? null,
    };
  }

  async findForAttendeesRoleMap(leadId: string): Promise<LeadForAttendeesRoleMap | null> {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        teamId: true,
        email: true,
        closer: {
          select: {
            id: true,
            supabaseId: true,
            fullName: true,
            email: true,
            googleConnection: {
              select: {
                accessToken: true,
                refreshToken: true,
                tokenExpiresAt: true,
                revokedAt: true,
              },
            },
          },
        },
        assignee: {
          select: { email: true },
        },
      },
    });

    if (!lead) return null;

    const c = lead.closer;
    return {
      teamId: lead.teamId,
      email: lead.email,
      closer: c?.supabaseId
        ? {
            id: c.id,
            supabaseId: c.supabaseId,
            fullName: c.fullName,
            email: c.email,
            googleCalendarConnected: !!c.googleConnection?.refreshToken && !c.googleConnection?.revokedAt,
            googleRefreshToken: c.googleConnection?.refreshToken ?? null,
            googleAccessToken: c.googleConnection?.accessToken ?? null,
            googleTokenExpiresAt: c.googleConnection?.tokenExpiresAt ?? null,
          }
        : null,
      assignee: lead.assignee,
    };
  }
}

// Singleton export
export const leadRepository = new LeadRepository();
