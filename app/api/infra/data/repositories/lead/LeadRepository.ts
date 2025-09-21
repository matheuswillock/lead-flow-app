import { ILeadRepository } from "./ILeadRepository";
import { Lead, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "../../prisma";

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
        assignee: true,
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

  async updateStatus(id: string, status: LeadStatus): Promise<Lead> {
    return await prisma.lead.update({
      where: { id },
      data: { status },
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

    const where: Prisma.LeadWhereInput = {
      managerId,
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(search && {
        OR: [
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
      assignedTo: operatorId, // Filtra apenas leads atribuídos ao operator
      ...(status && { status }),
      ...(search && {
        OR: [
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
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { leads };
  }
}