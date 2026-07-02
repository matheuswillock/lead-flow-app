import { ILeadRepository, type LeadCreateRepositoryInput, type LeadRecord, type LeadUpdateRepositoryInput, type TransferToTeamSanitization } from "./ILeadRepository";
import { ActivityType, Lead, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import type { LeadCloserForCalendar, LeadForAttendeesRoleMap } from "@/app/api/v1/leads/[id]/schedule/attendees/ScheduleAttendeesTypes";

// Statuses terminais não geram eventos de lead time no calendário.
const CALENDAR_TERMINAL_STATUSES: LeadStatus[] = [
  "contract_finalized",
  "opportunityLost",
  "disqualified",
  "operator_denied",
];

// Margem para trás no statusEnteredAt: o vencimento de lead time (statusEnteredAt + regra)
// pode cair dentro da janela mesmo quando o status começou antes dela.
const CALENDAR_LEAD_TIME_LOOKBACK_DAYS = 45;

function buildCalendarWindowFilter(windowStart: Date, windowEnd: Date): Prisma.LeadWhereInput {
  const leadTimeLookbackStart = new Date(
    windowStart.getTime() - CALENDAR_LEAD_TIME_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  );

  return {
    OR: [
      { meetingDate: { gte: windowStart, lte: windowEnd } },
      { status: "future_sale", followUpAt: { gte: windowStart, lte: windowEnd } },
      {
        status: { notIn: CALENDAR_TERMINAL_STATUSES },
        statusEnteredAt: { gte: leadTimeLookbackStart, lte: windowEnd },
      },
    ],
  };
}

const CRM_LEAD_LIST_SELECT = {
  id: true,
  leadCode: true,
  managerId: true,
  teamId: true,
  assignedTo: true,
  closerId: true,
  status: true,
  name: true,
  email: true,
  phone: true,
  cnpj: true,
  razaoSocial: true,
  age: true,
  currentHealthPlan: true,
  currentValue: true,
  referenceHospital: true,
  currentTreatment: true,
  meetingDate: true,
  meetingTitle: true,
  meetingNotes: true,
  meetingLink: true,
  meetingHeald: true,
  meetingPresenceConfirmed: true,
  meetingPresenceConfirmedAt: true,
  meetingType: true,
  isTransfer: true,
  followUpAt: true,
  followUpNotes: true,
  followUpSourceStatus: true,
  lossReason: true,
  lossReasonDetails: true,
  statusEnteredAt: true,
  notes: true,
  ticket: true,
  contractDueDate: true,
  soldPlan: true,
  isReferral: true,
  referrerLeadId: true,
  referrerName: true,
  referrerPhone: true,
  createdBy: true,
  updatedBy: true,
  createdAt: true,
  updatedAt: true,
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
  proposalReview: {
    select: {
      status: true,
    },
  },
  _count: {
    select: {
      attachments: true,
    },
  },
} satisfies Prisma.LeadSelect;

export class LeadRepository implements ILeadRepository {
  async create(data: LeadCreateRepositoryInput): Promise<LeadRecord> {
    return await prisma.lead.create({
      data: data as Prisma.LeadCreateInput,
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

  async findById(id: string): Promise<LeadRecord | null> {
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
          // Timeline inicial limitada — o restante é servido pela rota
          // paginada de activities.
          take: 50,
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

  async findLeadByPhoneInTeam(
    teamId: string,
    normalizedPhone: string
  ): Promise<Pick<Lead, "id"> | null> {
    const digits = normalizedPhone.replace(/\D/g, "")
    return prisma.lead.findFirst({
      where: {
        teamId,
        OR: [
          { phone: normalizedPhone },
          ...(digits ? [{ phone: { contains: digits.slice(-11) } }] : []),
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    })
  }

  async findOrCreateLeadByPhoneInTeam(params: {
    teamId: string;
    normalizedPhone: string;
    leadCode: string;
    displayName: string;
    masterId: string;
    conversationId: string;
  }): Promise<{ id: string; created: boolean }> {
    const digits = params.normalizedPhone.replace(/\D/g, "");

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.teamId} || ':' || ${params.normalizedPhone}))`;

      const existingLead = await tx.lead.findFirst({
        where: {
          teamId: params.teamId,
          OR: [
            { phone: params.normalizedPhone },
            ...(digits ? [{ phone: { contains: digits.slice(-11) } }] : []),
          ],
        },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      });

      if (existingLead) {
        return { id: existingLead.id, created: false };
      }

      const lead = await tx.lead.create({
        data: {
          manager: { connect: { id: params.masterId } },
          team: { connect: { id: params.teamId } },
          leadCode: params.leadCode,
          name: params.displayName,
          phone: params.normalizedPhone,
          status: LeadStatus.new_opportunity,
          creator: { connect: { id: params.masterId } },
          updater: { connect: { id: params.masterId } },
          activities: {
            create: {
              type: ActivityType.note,
              body: "Lead criado automaticamente via WhatsApp",
              payload: {
                kind: "lead_creation",
                channel: "whatsapp",
                provider: "evolution",
                source: "whatsapp_inbound",
                conversationId: params.conversationId,
                importedAt: new Date().toISOString(),
              },
              author: { connect: { id: params.masterId } },
            },
          },
        },
        select: { id: true },
      });

      return { id: lead.id, created: true };
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
      onlyTransfer?: boolean;
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
      onlyTransfer,
    } = options || {};

    const where: Prisma.LeadWhereInput = {
      managerId,
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(onlyTransfer && { isTransfer: true }),
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
        select: CRM_LEAD_LIST_SELECT,
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

  async update(id: string, data: LeadUpdateRepositoryInput): Promise<LeadRecord> {
    return await prisma.lead.update({
      where: { id },
      data: data as Prisma.LeadUpdateInput,
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

  async transferToTeam(
    id: string,
    targetTeamId: string,
    closerId: string,
    sdrId: string | null,
    sanitizations: TransferToTeamSanitization[] = []
  ): Promise<Lead> {
    return await prisma.$transaction(async (tx) => {
      for (const sanitization of sanitizations) {
        const sanitizeData: Prisma.LeadUpdateInput = {};
        if (sanitization.clearEmail) sanitizeData.email = null;
        if (sanitization.clearCnpj) sanitizeData.cnpj = null;
        if (Object.keys(sanitizeData).length > 0) {
          await tx.lead.update({
            where: { id: sanitization.leadId },
            data: sanitizeData,
          });
        }
      }

      return await tx.lead.update({
        where: { id },
        data: {
          teamId: targetTeamId,
          closerId,
          assignedTo: sdrId ?? null,
          updatedAt: new Date(),
          activities: {
            create: {
              type: "status_change",
              body: "Lead transferido para outro time",
              createdAt: new Date(),
            },
          },
        },
        include: {
          manager: { select: { id: true, fullName: true, email: true } },
          assignee: { select: { id: true, fullName: true, email: true, profileIconUrl: true } },
          closer: { select: { id: true, fullName: true, email: true, profileIconUrl: true } },
        },
      });
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
      onlyTransfer?: boolean;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
      onlyTransfer,
    } = options || {};

    const where: any = {
      managerId,
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(onlyTransfer && { isTransfer: true }),
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
      select: CRM_LEAD_LIST_SELECT,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { leads: leads as unknown as Lead[] };
  }

  async findAllByTeamId(
    teamId: string,
    options?: {
      status?: LeadStatus;
      assignedTo?: string;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
      calendarWindowStart?: Date;
      calendarWindowEnd?: Date;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
      onlyTransfer,
      calendarWindowStart,
      calendarWindowEnd,
    } = options || {};

    const where: any = {
      teamId,
      ...(status && { status }),
      ...(assignedTo && { assignedTo }),
      ...(onlyTransfer && { isTransfer: true }),
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
      ...(calendarWindowStart && calendarWindowEnd && {
        AND: [buildCalendarWindowFilter(calendarWindowStart, calendarWindowEnd)],
      }),
    };

    const leads = await prisma.lead.findMany({
      where,
      select: CRM_LEAD_LIST_SELECT,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return { leads: leads as unknown as Lead[] };
  }

  async findAllByOperatorId(
    operatorId: string,
    options?: {
      status?: LeadStatus;
      search?: string;
      startDate?: Date;
      endDate?: Date;
      onlyTransfer?: boolean;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      search,
      startDate,
      endDate,
      onlyTransfer,
    } = options || {};

    const where: Prisma.LeadWhereInput = {
      OR: [
        { assignedTo: operatorId }, // Leads atribuídos ao operator
        { createdBy: operatorId },   // Leads criados pelo operator
      ],
      ...(status && { status }),
      ...(onlyTransfer && { isTransfer: true }),
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
      onlyTransfer?: boolean;
      calendarWindowStart?: Date;
      calendarWindowEnd?: Date;
    }
  ): Promise<{ leads: Lead[] }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
      onlyTransfer,
      calendarWindowStart,
      calendarWindowEnd,
    } = options || {};

    const filters: Prisma.LeadWhereInput[] = [];

    if (calendarWindowStart && calendarWindowEnd) {
      filters.push(buildCalendarWindowFilter(calendarWindowStart, calendarWindowEnd));
    }

    if (status) {
      filters.push({ status });
    }

    if (assignedTo) {
      filters.push({ assignedTo });
    }

    if (onlyTransfer) {
      filters.push({ isTransfer: true });
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

  async findImportConflicts(
    teamId: string,
    emails: string[],
    cnpjs: string[]
  ): Promise<Array<{ id: string; email: string | null; cnpj: string | null; status: LeadStatus | null }>> {
    const conflictFilters: Prisma.LeadWhereInput[] = [];
    if (emails.length) conflictFilters.push({ email: { in: emails } });
    if (cnpjs.length) conflictFilters.push({ cnpj: { in: cnpjs } });
    if (!conflictFilters.length) return [];

    return await prisma.lead.findMany({
      where: {
        teamId,
        OR: conflictFilters,
      },
      select: {
        id: true,
        email: true,
        cnpj: true,
        status: true,
      },
    });
  }
}

// Singleton export
export const leadRepository = new LeadRepository();
