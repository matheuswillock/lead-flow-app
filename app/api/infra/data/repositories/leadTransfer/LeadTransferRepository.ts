import type { LeadStatus, Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  ILeadTransferRepository,
  LeadTransferCompletedRow,
  LeadTransferListFilters,
  LeadTransferPendingRow,
  LeadTransferProfileRef,
} from "./ILeadTransferRepository";

const PROFILE_SELECT = {
  id: true,
  fullName: true,
  email: true,
} satisfies Prisma.ProfileSelect;

function mapProfile(
  profile: { id: string; fullName: string | null; email: string } | null | undefined
): LeadTransferProfileRef | null {
  if (!profile) return null;
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
  };
}

function buildLeadSearchFilter(search?: string): Prisma.LeadWhereInput | undefined {
  const term = search?.trim();
  if (!term) return undefined;

  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
    ],
  };
}

function buildDateRange(
  from?: Date,
  to?: Date
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lt: to } : {}),
  };
}

function hasTransferDateFilter(filters: LeadTransferListFilters): boolean {
  return Boolean(filters.transferDateFrom || filters.transferDateTo);
}

export class LeadTransferRepository implements ILeadTransferRepository {
  async findPendingByTeam(filters: LeadTransferListFilters): Promise<LeadTransferPendingRow[]> {
    if (hasTransferDateFilter(filters)) {
      return [];
    }

    const {
      teamId,
      search,
      leadStatus,
      sdrProfileIds,
      closerProfileIds,
      preScheduledDateFrom,
      preScheduledDateTo,
      scheduledDateFrom,
      scheduledDateTo,
    } = filters;

    const preScheduledRange = buildDateRange(preScheduledDateFrom, preScheduledDateTo);
    const scheduledRange = buildDateRange(scheduledDateFrom, scheduledDateTo);

    const meetingDateFilter: Prisma.LeadWhereInput = {};
    if (preScheduledRange && scheduledRange) {
      meetingDateFilter.AND = [
        { meetingDate: preScheduledRange },
        { meetingDate: scheduledRange },
      ];
    } else if (preScheduledRange) {
      meetingDateFilter.meetingDate = preScheduledRange;
    } else if (scheduledRange) {
      meetingDateFilter.meetingDate = scheduledRange;
    }

    const leads = await prisma.lead.findMany({
      where: {
        teamId,
        isTransfer: true,
        ...(leadStatus ? { status: leadStatus as LeadStatus } : {}),
        ...(sdrProfileIds?.length ? { assignedTo: { in: sdrProfileIds } } : {}),
        ...(closerProfileIds?.length ? { closerId: { in: closerProfileIds } } : {}),
        ...(buildLeadSearchFilter(search) ?? {}),
        ...meetingDateFilter,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        meetingDate: true,
        updatedAt: true,
        assignee: { select: PROFILE_SELECT },
        closer: { select: PROFILE_SELECT },
      },
      orderBy: { updatedAt: "desc" },
    });

    return leads.map((lead) => ({
      kind: "pending" as const,
      leadId: lead.id,
      leadName: lead.name,
      leadEmail: lead.email,
      leadPhone: lead.phone,
      leadStatus: lead.status,
      sdr: mapProfile(lead.assignee),
      closer: mapProfile(lead.closer),
      preScheduledAt: lead.meetingDate,
      sortDate: lead.updatedAt,
      updatedAt: lead.updatedAt,
    }));
  }

  async findCompletedByTeam(filters: LeadTransferListFilters): Promise<LeadTransferCompletedRow[]> {
    const {
      teamId,
      search,
      leadStatus,
      toTeamIds,
      transferredByProfileIds,
      sdrProfileIds,
      closerProfileIds,
      transferDateFrom,
      transferDateTo,
      preScheduledDateFrom,
      preScheduledDateTo,
      scheduledDateFrom,
      scheduledDateTo,
    } = filters;

    const transferDateRange = buildDateRange(transferDateFrom, transferDateTo);
    const preScheduledRange = buildDateRange(preScheduledDateFrom, preScheduledDateTo);
    const scheduledRange = buildDateRange(scheduledDateFrom, scheduledDateTo);
    const leadSearch = buildLeadSearchFilter(search);

    const leadWhere: Prisma.LeadWhereInput = {
      ...(leadStatus ? { status: leadStatus as LeadStatus } : {}),
      ...(leadSearch ?? {}),
      ...(sdrProfileIds?.length ? { assignedTo: { in: sdrProfileIds } } : {}),
      ...(scheduledRange ? { meetingDate: scheduledRange } : {}),
    };

    const transfers = await prisma.leadTransfer.findMany({
      where: {
        fromTeamId: teamId,
        ...(toTeamIds?.length ? { toTeamId: { in: toTeamIds } } : {}),
        ...(transferredByProfileIds?.length
          ? { transferredByProfileId: { in: transferredByProfileIds } }
          : {}),
        ...(closerProfileIds?.length ? { receivedByProfileId: { in: closerProfileIds } } : {}),
        ...(transferDateRange ? { createdAt: transferDateRange } : {}),
        ...(preScheduledRange ? { preScheduledAt: preScheduledRange } : {}),
        lead: leadWhere,
      },
      select: {
        id: true,
        createdAt: true,
        preScheduledAt: true,
        toTeamId: true,
        toTeam: { select: { name: true } },
        transferredByProfile: { select: PROFILE_SELECT },
        receivedByProfile: { select: PROFILE_SELECT },
        lead: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            status: true,
            assignee: { select: PROFILE_SELECT },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return transfers.map((transfer) => ({
      kind: "completed" as const,
      transferId: transfer.id,
      leadId: transfer.lead.id,
      leadName: transfer.lead.name,
      leadEmail: transfer.lead.email,
      leadPhone: transfer.lead.phone,
      leadStatus: transfer.lead.status,
      sdr: mapProfile(transfer.lead.assignee),
      closer: mapProfile(transfer.receivedByProfile),
      destinationTeamId: transfer.toTeamId,
      destinationTeamName: transfer.toTeam.name,
      transferredBy: mapProfile(transfer.transferredByProfile)!,
      transferDate: transfer.createdAt,
      preScheduledAt: transfer.preScheduledAt,
      sortDate: transfer.createdAt,
    }));
  }

  async findFacetsByTeam(teamId: string) {
    const [transferRoutes, transfers] = await Promise.all([
      prisma.teamTransferRoute.findMany({
        where: { sourceTeamId: teamId },
        select: {
          targetTeam: { select: { id: true, name: true } },
        },
        orderBy: { targetTeam: { name: "asc" } },
      }),
      prisma.leadTransfer.findMany({
        where: { fromTeamId: teamId },
        select: {
          transferredByProfile: { select: PROFILE_SELECT },
        },
      }),
    ]);

    const destinationTeams = transferRoutes.map((route) => route.targetTeam);
    const transferredByMap = new Map<string, LeadTransferProfileRef>();

    for (const transfer of transfers) {
      const actor = mapProfile(transfer.transferredByProfile);
      if (actor) transferredByMap.set(actor.id, actor);
    }

    return {
      destinationTeams,
      transferredBy: Array.from(transferredByMap.values()).sort((a, b) =>
        (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email, "pt-BR")
      ),
    };
  }
}

export const leadTransferRepository = new LeadTransferRepository();
