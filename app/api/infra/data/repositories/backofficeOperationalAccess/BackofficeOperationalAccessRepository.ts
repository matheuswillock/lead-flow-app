import type { Prisma } from "@prisma/client";
import { BackofficeOperationalCapability } from "@prisma/client";
import { prisma } from "@/app/api/infra/data/prisma";
import type {
  IBackofficeOperationalAccessRepository,
  OperationalAccessGrantRow,
  OperationalAccessProfileRow,
} from "./IBackofficeOperationalAccessRepository";

const profileSelect = {
  id: true,
  fullName: true,
  email: true,
  isMaster: true,
} as const;

const actorSelect = {
  id: true,
  fullName: true,
  email: true,
} as const;

const grantSelect = {
  id: true,
  capability: true,
  profileId: true,
  teamId: true,
  isActive: true,
  notes: true,
  grantedByProfileId: true,
  grantedAt: true,
  revokedByProfileId: true,
  revokedAt: true,
  profile: { select: profileSelect },
  team: {
    select: {
      id: true,
      name: true,
      masterId: true,
      master: { select: profileSelect },
    },
  },
  grantedBy: { select: actorSelect },
  revokedBy: { select: actorSelect },
} satisfies Prisma.BackofficeOperationalAccessGrantSelect;

type GrantRow = Prisma.BackofficeOperationalAccessGrantGetPayload<{ select: typeof grantSelect }>;

function mapGrant(row: GrantRow): OperationalAccessGrantRow {
  return {
    id: row.id,
    capability: row.capability,
    profileId: row.profileId,
    teamId: row.teamId,
    isActive: row.isActive,
    notes: row.notes,
    grantedByProfileId: row.grantedByProfileId,
    grantedAt: row.grantedAt,
    revokedByProfileId: row.revokedByProfileId,
    revokedAt: row.revokedAt,
    profile: row.profile,
    team: row.team
      ? {
          id: row.team.id,
          name: row.team.name,
          masterId: row.team.masterId,
          master: row.team.master,
        }
      : null,
    grantedBy: row.grantedBy,
    revokedBy: row.revokedBy,
  };
}

export class BackofficeOperationalAccessRepository implements IBackofficeOperationalAccessRepository {
  async findProfileById(profileId: string): Promise<OperationalAccessProfileRow | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: profileSelect,
    });
  }

  async findTeamById(teamId: string): Promise<{ id: string; masterId: string; name: string } | null> {
    return prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, masterId: true, name: true },
    });
  }

  async findMultiskillTeamByMasterId(
    masterId: string,
    teamName: string
  ): Promise<{ id: string } | null> {
    return prisma.team.findFirst({
      where: { masterId, name: teamName },
      select: { id: true },
    });
  }

  async createMultiskillTeam(masterId: string, teamName: string): Promise<{ id: string }> {
    return prisma.team.create({
      data: {
        masterId,
        name: teamName,
        isDefault: false,
      },
      select: { id: true },
    });
  }

  async hasActiveGrant(input: {
    capability: BackofficeOperationalCapability;
    profileId?: string;
    teamId?: string;
  }): Promise<boolean> {
    const row = await prisma.backofficeOperationalAccessGrant.findFirst({
      where: {
        capability: input.capability,
        isActive: true,
        ...(input.profileId ? { profileId: input.profileId } : {}),
        ...(input.teamId ? { teamId: input.teamId } : {}),
      },
      select: { id: true },
    });
    return row !== null;
  }

  async listByCapability(
    capability: BackofficeOperationalCapability
  ): Promise<OperationalAccessGrantRow[]> {
    const rows = await prisma.backofficeOperationalAccessGrant.findMany({
      where: { capability },
      select: grantSelect,
      orderBy: [{ isActive: "desc" }, { grantedAt: "desc" }],
    });
    return rows.map(mapGrant);
  }

  async listEligibleMasters(excludeProfileIds: string[]): Promise<OperationalAccessProfileRow[]> {
    return prisma.profile.findMany({
      where: {
        isMaster: true,
        id: excludeProfileIds.length ? { notIn: excludeProfileIds } : undefined,
      },
      select: profileSelect,
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
      take: 200,
    });
  }

  async listEligibleMastersForMultiskill(
    excludeMasterIds: string[]
  ): Promise<OperationalAccessProfileRow[]> {
    const activeOriginMasterIds = await prisma.backofficeOperationalAccessGrant.findMany({
      where: {
        capability: BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN,
        isActive: true,
        teamId: { not: null },
      },
      select: { team: { select: { masterId: true } } },
    });

    const blocked = new Set([
      ...excludeMasterIds,
      ...activeOriginMasterIds.map((row) => row.team?.masterId).filter(Boolean),
    ] as string[]);

    return prisma.profile.findMany({
      where: {
        isMaster: true,
        id: blocked.size ? { notIn: Array.from(blocked) } : undefined,
      },
      select: profileSelect,
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
      take: 200,
    });
  }

  async grantAssociadosQueue(input: {
    profileId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow> {
    const existing = await prisma.backofficeOperationalAccessGrant.findFirst({
      where: {
        capability: BackofficeOperationalCapability.ASSOCIADOS_QUEUE,
        profileId: input.profileId,
      },
      select: { id: true },
    });

    const row = existing
      ? await prisma.backofficeOperationalAccessGrant.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            grantedByProfileId: input.grantedByProfileId,
            grantedAt: new Date(),
            revokedByProfileId: null,
            revokedAt: null,
            notes: input.notes ?? null,
          },
          select: grantSelect,
        })
      : await prisma.backofficeOperationalAccessGrant.create({
          data: {
            capability: BackofficeOperationalCapability.ASSOCIADOS_QUEUE,
            profileId: input.profileId,
            isActive: true,
            grantedByProfileId: input.grantedByProfileId,
            notes: input.notes ?? null,
          },
          select: grantSelect,
        });

    return mapGrant(row);
  }

  async grantMultiskillOrigin(input: {
    teamId: string;
    grantedByProfileId: string;
    notes?: string | null;
  }): Promise<OperationalAccessGrantRow> {
    const existing = await prisma.backofficeOperationalAccessGrant.findFirst({
      where: {
        capability: BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN,
        teamId: input.teamId,
      },
      select: { id: true },
    });

    const row = existing
      ? await prisma.backofficeOperationalAccessGrant.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            grantedByProfileId: input.grantedByProfileId,
            grantedAt: new Date(),
            revokedByProfileId: null,
            revokedAt: null,
            notes: input.notes ?? null,
          },
          select: grantSelect,
        })
      : await prisma.backofficeOperationalAccessGrant.create({
          data: {
            capability: BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN,
            teamId: input.teamId,
            isActive: true,
            grantedByProfileId: input.grantedByProfileId,
            notes: input.notes ?? null,
          },
          select: grantSelect,
        });

    return mapGrant(row);
  }

  async revoke(grantId: string, revokedByProfileId: string): Promise<OperationalAccessGrantRow | null> {
    const existing = await prisma.backofficeOperationalAccessGrant.findUnique({
      where: { id: grantId },
      select: { id: true, isActive: true },
    });
    if (!existing?.isActive) return null;

    const row = await prisma.backofficeOperationalAccessGrant.update({
      where: { id: grantId },
      data: {
        isActive: false,
        revokedByProfileId,
        revokedAt: new Date(),
      },
      select: grantSelect,
    });
    return mapGrant(row);
  }

  async findActiveMultiskillGrantByTeamId(teamId: string): Promise<{ id: string } | null> {
    return prisma.backofficeOperationalAccessGrant.findFirst({
      where: {
        capability: BackofficeOperationalCapability.MULTISKILL_TRANSFER_ORIGIN,
        teamId,
        isActive: true,
      },
      select: { id: true },
    });
  }
}

export const backofficeOperationalAccessRepository = new BackofficeOperationalAccessRepository();
