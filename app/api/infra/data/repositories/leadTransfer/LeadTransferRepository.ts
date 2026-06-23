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

export class LeadTransferRepository implements ILeadTransferRepository {
  async findPendingByTeam(filters: LeadTransferListFilters): Promise<LeadTransferPendingRow[]> {
    const { teamId, search, leadStatus, dateFrom, dateTo } = filters;

    const dateFilter: Prisma.LeadWhereInput = {};
    if (dateFrom || dateTo) {
      dateFilter.updatedAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lt: dateTo } : {}),
      };
    }

    const leads = await prisma.lead.findMany({
      where: {
        teamId,
        isTransfer: true,
        ...(leadStatus ? { status: leadStatus as LeadStatus } : {}),
        ...(buildLeadSearchFilter(search) ?? {}),
        ...dateFilter,
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
    const { teamId, search, leadStatus, toTeamId, transferredByProfileId, dateFrom, dateTo } = filters;

    const dateFilter: Prisma.LeadTransferWhereInput = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lt: dateTo } : {}),
      };
    }

    const leadSearch = buildLeadSearchFilter(search);

    const transfers = await prisma.leadTransfer.findMany({
      where: {
        fromTeamId: teamId,
        ...(toTeamId ? { toTeamId } : {}),
        ...(transferredByProfileId ? { transferredByProfileId } : {}),
        ...dateFilter,
        lead: {
          ...(leadStatus ? { status: leadStatus as LeadStatus } : {}),
          ...(leadSearch ?? {}),
        },
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
    const transfers = await prisma.leadTransfer.findMany({
      where: { fromTeamId: teamId },
      select: {
        toTeam: { select: { id: true, name: true } },
        transferredByProfile: { select: PROFILE_SELECT },
      },
    });

    const destinationTeamsMap = new Map<string, { id: string; name: string }>();
    const transferredByMap = new Map<string, LeadTransferProfileRef>();

    for (const transfer of transfers) {
      destinationTeamsMap.set(transfer.toTeam.id, transfer.toTeam);
      const actor = mapProfile(transfer.transferredByProfile);
      if (actor) transferredByMap.set(actor.id, actor);
    }

    return {
      destinationTeams: Array.from(destinationTeamsMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR")
      ),
      transferredBy: Array.from(transferredByMap.values()).sort((a, b) =>
        (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email, "pt-BR")
      ),
    };
  }
}

export const leadTransferRepository = new LeadTransferRepository();
