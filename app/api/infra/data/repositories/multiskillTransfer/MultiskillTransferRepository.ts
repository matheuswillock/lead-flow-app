import type { Prisma } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type { TransferToTeamSanitization } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type {
  ListMultiskillTransferTargetsResult,
  MultiskillTransferTarget,
} from "@/lib/multiskill/types";
import { isLostStatus } from "@/lib/leadImport/normalizers";
import type { IMultiskillTransferRepository } from "./IMultiskillTransferRepository";

function formatLeadConflictLabel(conflict: {
  leadCode: string | null;
  name: string;
}): string {
  return conflict.leadCode ?? conflict.name;
}

export class MultiskillTransferRepository implements IMultiskillTransferRepository {
  async findMasterIdByEmail(email: string): Promise<string | null> {
    const profile = await prisma.profile.findUnique({
      where: { email },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async findDefaultTeamForMaster(masterId: string): Promise<{ id: string; name: string } | null> {
    const defaultTeam = await prisma.team.findFirst({
      where: { masterId, isDefault: true },
      select: { id: true, name: true },
    });
    if (defaultTeam) return defaultTeam;

    return prisma.team.findFirst({
      where: { masterId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
  }

  async listTransferTargets(input: {
    originMasterId: string;
    query?: string;
    page: number;
    pageSize: number;
  }): Promise<ListMultiskillTransferTargetsResult> {
    const page = Math.max(input.page, 1);
    const pageSize = Math.max(Math.min(input.pageSize, 100), 1);
    const q = input.query?.trim();

    const searchFilter: Prisma.ProfileWhereInput | undefined = q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            {
              teamsOwned: {
                some: {
                  isDefault: true,
                  name: { contains: q, mode: "insensitive" },
                },
              },
            },
            {
              teamsOwned: {
                some: {
                  members: {
                    some: {
                      functions: { has: "CLOSER" },
                      profile: {
                        OR: [
                          { fullName: { contains: q, mode: "insensitive" } },
                          { email: { contains: q, mode: "insensitive" } },
                        ],
                      },
                    },
                  },
                },
              },
            },
          ],
        }
      : undefined;

    const where: Prisma.ProfileWhereInput = {
      isMaster: true,
      multiskillEnabled: true,
      id: { not: input.originMasterId },
      ...(searchFilter ?? {}),
    };

    const [totalItems, masters] = await Promise.all([
      prisma.profile.count({ where }),
      prisma.profile.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          email: true,
          teamsOwned: {
            select: {
              id: true,
              name: true,
              isDefault: true,
              createdAt: true,
              members: {
                where: { functions: { has: "CLOSER" } },
                select: {
                  teamId: true,
                  profile: {
                    select: {
                      id: true,
                      fullName: true,
                      email: true,
                    },
                  },
                  team: {
                    select: { name: true },
                  },
                },
              },
            },
            orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          },
        },
        orderBy: [{ fullName: "asc" }, { email: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const items: MultiskillTransferTarget[] = masters.flatMap((master) => {
      const defaultTeam =
        master.teamsOwned.find((team) => team.isDefault) ?? master.teamsOwned[0] ?? null;
      if (!defaultTeam) return [];

      // Only default-team closers: transfer validates with findCloserOnDefaultTeam.
      const defaultTeamClosers = defaultTeam.members.map((member) => ({
        profileId: member.profile.id,
        fullName: member.profile.fullName,
        email: member.profile.email,
        teamId: member.teamId,
        teamName: member.team.name,
      }));

      return [
        {
          masterId: master.id,
          masterName: master.fullName,
          masterEmail: master.email,
          defaultTeamId: defaultTeam.id,
          defaultTeamName: defaultTeam.name,
          closers: defaultTeamClosers,
        },
      ];
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      items,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  async resolveTransferTeamUniqueConflicts(
    lead: { id: string; email: string | null; cnpj: string | null },
    targetTeamId: string
  ): Promise<{ ok: true; sanitizations: TransferToTeamSanitization[] } | { ok: false; message: string }> {
    const conflictFilters: Prisma.LeadWhereInput[] = [];
    if (lead.email) {
      conflictFilters.push({ email: { equals: lead.email, mode: "insensitive" } });
    }
    const normalizedCnpj = lead.cnpj?.trim();
    if (normalizedCnpj) {
      conflictFilters.push({ cnpj: normalizedCnpj });
    }

    if (!conflictFilters.length) {
      return { ok: true, sanitizations: [] };
    }

    const conflicts = await prisma.lead.findMany({
      where: {
        teamId: targetTeamId,
        NOT: { id: lead.id },
        OR: conflictFilters,
      },
      select: { id: true, email: true, cnpj: true, leadCode: true, name: true, status: true },
    });

    const sanitizationByLeadId = new Map<string, TransferToTeamSanitization>();

    for (const conflict of conflicts) {
      const emailMatches =
        !!lead.email &&
        !!conflict.email &&
        lead.email.toLowerCase() === conflict.email.toLowerCase();
      const cnpjMatches = !!normalizedCnpj && conflict.cnpj === normalizedCnpj;

      if (emailMatches) {
        if (!isLostStatus(conflict.status)) {
          return {
            ok: false,
            message: `Já existe um lead com este e-mail no time destino (${formatLeadConflictLabel(conflict)})`,
          };
        }
        const existing = sanitizationByLeadId.get(conflict.id) ?? {
          leadId: conflict.id,
          clearEmail: false,
          clearCnpj: false,
        };
        existing.clearEmail = true;
        sanitizationByLeadId.set(conflict.id, existing);
      }

      if (cnpjMatches) {
        if (!isLostStatus(conflict.status)) {
          return {
            ok: false,
            message: `Já existe um lead com este CNPJ no time destino (${formatLeadConflictLabel(conflict)})`,
          };
        }
        const existing = sanitizationByLeadId.get(conflict.id) ?? {
          leadId: conflict.id,
          clearEmail: false,
          clearCnpj: false,
        };
        existing.clearCnpj = true;
        sanitizationByLeadId.set(conflict.id, existing);
      }
    }

    return { ok: true, sanitizations: Array.from(sanitizationByLeadId.values()) };
  }

  async findLeadForMultiskillTransfer(leadId: string) {
    return prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        status: true,
        managerId: true,
        teamId: true,
        email: true,
        cnpj: true,
        isTransfer: true,
        meetingDate: true,
        team: { select: { masterId: true } },
      },
    });
  }

  async findMasterMultiskillProfile(masterId: string) {
    return prisma.profile.findFirst({
      where: {
        id: masterId,
        isMaster: true,
        multiskillEnabled: true,
      },
      select: { id: true, multiskillEnabled: true },
    });
  }

  async findCloserOnDefaultTeam(input: {
    defaultTeamId: string;
    closerId: string;
    masterId: string;
  }): Promise<boolean> {
    const closerMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId: input.defaultTeamId,
          profileId: input.closerId,
        },
      },
      select: { functions: true, team: { select: { masterId: true } } },
    });

    return (
      closerMember?.team.masterId === input.masterId &&
      closerMember.functions.includes("CLOSER")
    );
  }

  async findSdrOnDefaultTeam(input: {
    defaultTeamId: string;
    sdrId: string;
    masterId: string;
  }): Promise<boolean> {
    const sdrMember = await prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId: input.defaultTeamId,
          profileId: input.sdrId,
        },
      },
      select: { functions: true, team: { select: { masterId: true } } },
    });

    return sdrMember?.team.masterId === input.masterId && sdrMember.functions.includes("SDR");
  }

  async findTransferDelegationMembership(teamId: string, profileId: string) {
    return prisma.teamMember.findUnique({
      where: {
        teamId_profileId: {
          teamId,
          profileId,
        },
      },
      select: { role: true, canTransferAccountLeads: true },
    });
  }

  async clearLeadTransferFlag(leadId: string) {
    return prisma.lead.update({
      where: { id: leadId },
      data: { isTransfer: false },
      select: { id: true },
    });
  }

  async createMultiskillLeadTransfer(data: {
    leadId: string;
    fromTeamId: string;
    toTeamId: string;
    transferredByProfileId: string;
    receivedByProfileId: string;
    fromManagerId: string;
    toManagerId: string;
    transferTagUsed: boolean;
    preScheduledAt: Date | null;
  }) {
    return prisma.leadTransfer.create({ data });
  }
}

export const multiskillTransferRepository = new MultiskillTransferRepository();
