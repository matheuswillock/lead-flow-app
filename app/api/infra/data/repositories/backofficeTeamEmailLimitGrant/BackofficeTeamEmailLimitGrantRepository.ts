import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  IBackofficeTeamEmailLimitGrantRepository,
  TeamEmailLimitGrantRow,
  TeamSearchRow,
} from "./IBackofficeTeamEmailLimitGrantRepository"

const masterSelect = {
  id: true,
  fullName: true,
  email: true,
} as const

const actorSelect = {
  id: true,
  fullName: true,
  email: true,
} as const

const grantSelect = {
  id: true,
  teamId: true,
  maxEmailsPerDay: true,
  isActive: true,
  notes: true,
  grantedByProfileId: true,
  grantedAt: true,
  revokedByProfileId: true,
  revokedAt: true,
  team: {
    select: {
      id: true,
      name: true,
      masterId: true,
      master: { select: masterSelect },
    },
  },
  grantedBy: { select: actorSelect },
  revokedBy: { select: actorSelect },
} satisfies Prisma.BackofficeTeamEmailLimitGrantSelect

type GrantRow = Prisma.BackofficeTeamEmailLimitGrantGetPayload<{ select: typeof grantSelect }>

function mapGrant(row: GrantRow): TeamEmailLimitGrantRow {
  return {
    id: row.id,
    teamId: row.teamId,
    maxEmailsPerDay: row.maxEmailsPerDay,
    isActive: row.isActive,
    notes: row.notes,
    grantedByProfileId: row.grantedByProfileId,
    grantedAt: row.grantedAt,
    revokedByProfileId: row.revokedByProfileId,
    revokedAt: row.revokedAt,
    team: row.team,
    grantedBy: row.grantedBy,
    revokedBy: row.revokedBy,
  }
}

export class BackofficeTeamEmailLimitGrantRepository implements IBackofficeTeamEmailLimitGrantRepository {
  async listActive(): Promise<TeamEmailLimitGrantRow[]> {
    const rows = await prisma.backofficeTeamEmailLimitGrant.findMany({
      where: { isActive: true },
      select: grantSelect,
      orderBy: { grantedAt: "desc" },
    })
    return rows.map(mapGrant)
  }

  async findById(grantId: string): Promise<TeamEmailLimitGrantRow | null> {
    const row = await prisma.backofficeTeamEmailLimitGrant.findUnique({
      where: { id: grantId },
      select: grantSelect,
    })
    return row ? mapGrant(row) : null
  }

  async findTeamById(teamId: string): Promise<{ id: string; name: string } | null> {
    return prisma.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { id: true, name: true },
    })
  }

  async searchTeams(query: string, limit = 20): Promise<TeamSearchRow[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    return prisma.team.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: trimmed, mode: "insensitive" } },
          { master: { fullName: { contains: trimmed, mode: "insensitive" } } },
          { master: { email: { contains: trimmed, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        master: { select: masterSelect },
      },
      orderBy: [{ master: { fullName: "asc" } }, { name: "asc" }],
      take: limit,
    })
  }

  async upsertGrant(input: {
    teamId: string
    maxEmailsPerDay: number | null
    notes?: string | null
    grantedByProfileId: string
  }): Promise<TeamEmailLimitGrantRow> {
    const row = await prisma.backofficeTeamEmailLimitGrant.upsert({
      where: { teamId: input.teamId },
      create: {
        teamId: input.teamId,
        maxEmailsPerDay: input.maxEmailsPerDay,
        notes: input.notes ?? null,
        grantedByProfileId: input.grantedByProfileId,
        isActive: true,
        revokedByProfileId: null,
        revokedAt: null,
      },
      update: {
        maxEmailsPerDay: input.maxEmailsPerDay,
        notes: input.notes ?? null,
        grantedByProfileId: input.grantedByProfileId,
        grantedAt: new Date(),
        isActive: true,
        revokedByProfileId: null,
        revokedAt: null,
      },
      select: grantSelect,
    })
    return mapGrant(row)
  }

  async updateGrant(
    grantId: string,
    input: {
      maxEmailsPerDay?: number | null
      notes?: string | null
      grantedByProfileId: string
    }
  ): Promise<TeamEmailLimitGrantRow | null> {
    const existing = await prisma.backofficeTeamEmailLimitGrant.findUnique({
      where: { id: grantId },
      select: { id: true, isActive: true },
    })
    if (!existing?.isActive) return null

    const row = await prisma.backofficeTeamEmailLimitGrant.update({
      where: { id: grantId },
      data: {
        ...(input.maxEmailsPerDay !== undefined && { maxEmailsPerDay: input.maxEmailsPerDay }),
        ...(input.notes !== undefined && { notes: input.notes }),
        grantedByProfileId: input.grantedByProfileId,
        grantedAt: new Date(),
      },
      select: grantSelect,
    })
    return mapGrant(row)
  }

  async revoke(grantId: string, revokedByProfileId: string): Promise<TeamEmailLimitGrantRow | null> {
    const existing = await prisma.backofficeTeamEmailLimitGrant.findUnique({
      where: { id: grantId },
      select: { id: true, isActive: true },
    })
    if (!existing?.isActive) return null

    const row = await prisma.backofficeTeamEmailLimitGrant.update({
      where: { id: grantId },
      data: {
        isActive: false,
        revokedByProfileId,
        revokedAt: new Date(),
      },
      select: grantSelect,
    })
    return mapGrant(row)
  }
}

export const backofficeTeamEmailLimitGrantRepository = new BackofficeTeamEmailLimitGrantRepository()
