import { ILeadRepository, type LeadCreateRepositoryInput, type LeadDuplicateCandidateRecord, type LeadMergeTransactionInput, type LeadRecord, type LeadUpdateRepositoryInput, type TransferToTeamSanitization } from "./ILeadRepository";
import { ActivityType, Lead, LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { buildStudioActivityData } from "@/lib/studio-feed-identity";
import { normalizeLeadPhoneDigits } from "@/lib/masks";
import type { LeadCloserForCalendar, LeadForAttendeesRoleMap } from "@/app/api/v1/leads/[id]/schedule/attendees/ScheduleAttendeesTypes";
import {
  buildCustomFieldWhereFilter,
  compareCustomFieldSortValues,
  type CustomFieldFilterInput,
  type CustomFieldSortInput,
} from "@/lib/leadCustomFields/customFieldQuery";

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

/**
 * Ordena leads pelo valor de um custom field carregado via select condicional
 * (ver `withCustomFieldSortSelect`) e remove o campo temporário antes de
 * retornar, para não vazar `customFieldValues` no shape público de `Lead`.
 * Escolhido em memória (não `$queryRaw`) porque as listagens atuais de
 * CRM/board não paginam no banco — todos os leads do filtro já estão
 * carregados, então uma segunda query só adicionaria latência sem necessidade.
 */
function sortByCustomField<T extends { id: string; customFieldValues?: Array<{ value: Prisma.JsonValue }> }>(
  leads: T[],
  sort: CustomFieldSortInput
): T[] {
  const sorted = [...leads].sort((a, b) =>
    compareCustomFieldSortValues(
      a.customFieldValues?.[0]?.value ?? null,
      b.customFieldValues?.[0]?.value ?? null,
      sort.direction
    )
  );
  return sorted.map((lead) => {
    const { customFieldValues: _customFieldValues, ...rest } = lead;
    return rest as T;
  });
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
  deletedAt: true,
  deletedByProfileId: true,
  createdAt: true,
  updatedAt: true,
  originChannel: true,
  originMetadata: true,
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
    return await prisma.lead.findFirst({
      where: { id, deletedAt: null },
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
    return await prisma.lead.findFirst({
      where: { leadCode, deletedAt: null },
    });
  }

  async findLeadByPhoneInTeam(
    teamId: string,
    normalizedPhone: string
  ): Promise<Pick<Lead, "id"> | null> {
    const digits = normalizedPhone.replace(/\D/g, "")
    const leadPhone = normalizeLeadPhoneDigits(normalizedPhone)
    return prisma.lead.findFirst({
      where: {
        teamId,
        deletedAt: null,
        OR: [
          { phone: normalizedPhone },
          ...(leadPhone ? [{ phone: leadPhone }] : []),
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
    const leadPhone = normalizeLeadPhoneDigits(params.normalizedPhone);

    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.teamId} || ':' || ${params.normalizedPhone}))`;

      const existingLead = await tx.lead.findFirst({
        where: {
          teamId: params.teamId,
          deletedAt: null,
          OR: [
            { phone: params.normalizedPhone },
            ...(leadPhone ? [{ phone: leadPhone }] : []),
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
          phone: leadPhone || params.normalizedPhone,
          status: LeadStatus.new_opportunity,
          creator: { connect: { id: params.masterId } },
          updater: { connect: { id: params.masterId } },
          activities: {
            create: buildStudioActivityData({
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
            }),
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
      deletedAt: null,
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
        deletedAt: null,
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
            ...buildStudioActivityData({
              type: ActivityType.status_change,
              body: reason || "Lead transferido para novo gestor",
            }),
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
    sanitizations: TransferToTeamSanitization[] = [],
    options?: { targetManagerId?: string }
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
          ...(options?.targetManagerId ? { managerId: options.targetManagerId } : {}),
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
      deletedAt: null,
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

  // C6 EXPLAIN (5k leads/team, 50/50 value split on customFieldFilters): Postgres correctly
  // picks a seq scan + hash join over lead_custom_field_values_definition_value_idx
  // (definitionId, value) at this selectivity — the index exists and would kick in for a
  // rarer filter value; no additional index proven necessary for this access pattern.
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
      customFieldFilters?: CustomFieldFilterInput[];
      customFieldSort?: CustomFieldSortInput;
      limit?: number;
    }
  ): Promise<{ leads: Lead[]; total: number }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
      onlyTransfer,
      calendarWindowStart,
      calendarWindowEnd,
      customFieldFilters,
      customFieldSort,
      limit,
    } = options || {};

    const take = limit !== undefined ? Math.min(limit, 1000) : undefined;

    const andClauses: Prisma.LeadWhereInput[] = [];
    if (calendarWindowStart && calendarWindowEnd) {
      andClauses.push(buildCalendarWindowFilter(calendarWindowStart, calendarWindowEnd));
    }
    for (const filter of customFieldFilters ?? []) {
      andClauses.push(buildCustomFieldWhereFilter(filter));
    }

    const where: any = {
      teamId,
      deletedAt: null,
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
      ...(andClauses.length > 0 && { AND: andClauses }),
    };

    const select = customFieldSort
      ? {
          ...CRM_LEAD_LIST_SELECT,
          customFieldValues: {
            where: { definitionId: customFieldSort.definitionId },
            select: { value: true },
          },
        }
      : CRM_LEAD_LIST_SELECT;

    // When customFieldSort is active the in-memory sort must run over the full
    // matching set, so skip the take to avoid returning a mis-ordered subset.
    const effectiveTake = customFieldSort ? undefined : take;

    const [rawLeads, total] = await prisma.$transaction([
      prisma.lead.findMany({ where, select, orderBy: { createdAt: 'desc' }, take: effectiveTake }),
      prisma.lead.count({ where }),
    ]);

    const leads = customFieldSort ? sortByCustomField(rawLeads, customFieldSort) : rawLeads;

    return { leads: leads as unknown as Lead[], total };
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
      deletedAt: null,
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

  // C6 EXPLAIN: same custom-field-filter access pattern and conclusion as findAllByTeamId above.
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
      customFieldFilters?: CustomFieldFilterInput[];
      customFieldSort?: CustomFieldSortInput;
      limit?: number;
    }
  ): Promise<{ leads: Lead[]; total: number }> {
    const {
      status,
      assignedTo,
      search,
      startDate,
      endDate,
      onlyTransfer,
      calendarWindowStart,
      calendarWindowEnd,
      customFieldFilters,
      customFieldSort,
      limit,
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

    for (const filter of customFieldFilters ?? []) {
      filters.push(buildCustomFieldWhereFilter(filter));
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
      deletedAt: null,
      AND: [visibilityFilter, ...filters],
    };

    const take = limit !== undefined ? Math.min(limit, 1000) : undefined;

    const select = customFieldSort
      ? {
          ...CRM_LEAD_LIST_SELECT,
          customFieldValues: {
            where: { definitionId: customFieldSort.definitionId },
            select: { value: true },
          },
        }
      : CRM_LEAD_LIST_SELECT;

    // When customFieldSort is active the in-memory sort must run over the full
    // matching set, so skip the take to avoid returning a mis-ordered subset.
    const effectiveTake = customFieldSort ? undefined : take;

    const [rawLeads, total] = await prisma.$transaction([
      prisma.lead.findMany({ where, select, orderBy: { createdAt: 'desc' }, take: effectiveTake }),
      prisma.lead.count({ where }),
    ]);

    const leads = customFieldSort ? sortByCustomField(rawLeads, customFieldSort) : rawLeads;

    return { leads: leads as unknown as Lead[], total };
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
        deletedAt: null,
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

  private readonly duplicateCandidateSelect = {
    id: true,
    leadCode: true,
    name: true,
    phone: true,
    email: true,
    status: true,
    createdAt: true,
  } as const;

  async findDuplicateDirectMatches(
    teamId: string,
    input: { phone?: string; email?: string; excludeLeadId?: string; limit?: number }
  ): Promise<LeadDuplicateCandidateRecord[]> {
    const orConditions: Prisma.LeadWhereInput[] = [];
    if (input.phone) orConditions.push({ phone: input.phone });
    if (input.email) orConditions.push({ email: input.email });
    if (!orConditions.length) return [];

    return prisma.lead.findMany({
      where: {
        teamId,
        deletedAt: null,
        ...(input.excludeLeadId ? { id: { not: input.excludeLeadId } } : {}),
        OR: orConditions,
      },
      select: this.duplicateCandidateSelect,
      take: input.limit ?? 5,
      orderBy: { createdAt: "desc" },
    });
  }

  async findDuplicateScanCandidates(
    teamId: string,
    input: { hasPhone: boolean; hasEmail: boolean; excludeLeadId?: string; limit?: number }
  ): Promise<LeadDuplicateCandidateRecord[]> {
    const orConditions: Prisma.LeadWhereInput[] = [];
    if (input.hasPhone) orConditions.push({ phone: { not: null } });
    if (input.hasEmail) orConditions.push({ email: { not: null } });
    if (!orConditions.length) return [];

    return prisma.lead.findMany({
      where: {
        teamId,
        deletedAt: null,
        ...(input.excludeLeadId ? { id: { not: input.excludeLeadId } } : {}),
        OR: orConditions,
      },
      select: this.duplicateCandidateSelect,
      take: input.limit ?? 200,
      orderBy: { createdAt: "desc" },
    });
  }

  async getMergeRelationSnapshot(targetLeadId: string, sourceLeadId: string) {
    const [
      targetPortfolio,
      sourcePortfolio,
      targetProposalReview,
      sourceProposalReview,
      targetSchedule,
      sourceSchedule,
    ] = await Promise.all([
      prisma.leadPortfolio.findUnique({ where: { leadId: targetLeadId }, select: { id: true } }),
      prisma.leadPortfolio.findUnique({ where: { leadId: sourceLeadId }, select: { id: true } }),
      prisma.leadProposalReview.findUnique({ where: { leadId: targetLeadId }, select: { id: true } }),
      prisma.leadProposalReview.findUnique({ where: { leadId: sourceLeadId }, select: { id: true } }),
      prisma.leadsSchedule.findUnique({ where: { leadId: targetLeadId }, select: { id: true } }),
      prisma.leadsSchedule.findUnique({ where: { leadId: sourceLeadId }, select: { id: true } }),
    ]);

    return {
      targetPortfolio: Boolean(targetPortfolio),
      sourcePortfolio: Boolean(sourcePortfolio),
      targetProposalReview: Boolean(targetProposalReview),
      sourceProposalReview: Boolean(sourceProposalReview),
      targetSchedule: Boolean(targetSchedule),
      sourceSchedule: Boolean(sourceSchedule),
    };
  }

  async mergeLeadsInTransaction(input: LeadMergeTransactionInput): Promise<void> {
    const { targetLead, sourceLead, fillPatch, mergedByProfileId, migratePortfolio, migrateProposalReview } =
      input;

    await prisma.$transaction(async (tx) => {
      await tx.leadActivity.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.task.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.leadsSchedule.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.leadFinalized.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.leadTransfer.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.leadAttachment.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.leadRequiredDocument.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.whatsAppConversation.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.whatsAppMessage.updateMany({
        where: { leadId: sourceLead.id },
        data: { leadId: targetLead.id },
      });
      await tx.lead.updateMany({
        where: { referrerLeadId: sourceLead.id },
        data: { referrerLeadId: targetLead.id },
      });

      if (migratePortfolio) {
        await tx.leadPortfolio.update({
          where: { leadId: sourceLead.id },
          data: { leadId: targetLead.id },
        });
      }

      if (migrateProposalReview) {
        await tx.leadProposalReview.update({
          where: { leadId: sourceLead.id },
          data: { leadId: targetLead.id },
        });
      }

      await tx.lead.delete({ where: { id: sourceLead.id } });

      if (Object.keys(fillPatch).length > 0) {
        await tx.lead.update({
          where: { id: targetLead.id },
          data: fillPatch,
        });
      }

      await tx.leadActivity.create({
        data: {
          leadId: targetLead.id,
          type: ActivityType.note,
          body: `Lead ${sourceLead.leadCode} mesclado neste registro`,
          createdBy: mergedByProfileId,
          payload: {
            mergedLeadId: sourceLead.id,
            mergedLeadCode: sourceLead.leadCode,
            mergedBy: mergedByProfileId,
          },
        },
      });
    });
  }
}

// Singleton export
export const leadRepository = new LeadRepository();
