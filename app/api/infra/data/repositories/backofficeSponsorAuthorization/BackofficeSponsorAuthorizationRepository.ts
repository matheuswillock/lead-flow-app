import type { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import type {
  AuthorizedSponsorProfileRow,
  AuthorizedSponsorRecordRow,
  IBackofficeSponsorAuthorizationRepository,
} from "./IBackofficeSponsorAuthorizationRepository"

const profileSelect = {
  id: true,
  fullName: true,
  email: true,
  isMaster: true,
} as const

const actorSelect = {
  id: true,
  fullName: true,
  email: true,
} as const

const recordSelect = {
  id: true,
  profileId: true,
  isActive: true,
  grantedByProfileId: true,
  grantedAt: true,
  revokedByProfileId: true,
  revokedAt: true,
  notes: true,
  profile: { select: profileSelect },
  grantedBy: { select: actorSelect },
  revokedBy: { select: actorSelect },
} satisfies Prisma.BackofficeAuthorizedSponsorSelect

type RecordRow = Prisma.BackofficeAuthorizedSponsorGetPayload<{ select: typeof recordSelect }>

function mapRecord(row: RecordRow): AuthorizedSponsorRecordRow {
  return {
    id: row.id,
    profileId: row.profileId,
    isActive: row.isActive,
    grantedByProfileId: row.grantedByProfileId,
    grantedAt: row.grantedAt,
    revokedByProfileId: row.revokedByProfileId,
    revokedAt: row.revokedAt,
    notes: row.notes,
    profile: row.profile,
    grantedBy: row.grantedBy,
    revokedBy: row.revokedBy,
  }
}

export class BackofficeSponsorAuthorizationRepository implements IBackofficeSponsorAuthorizationRepository {
  async findProfileById(profileId: string): Promise<AuthorizedSponsorProfileRow | null> {
    return prisma.profile.findUnique({
      where: { id: profileId },
      select: profileSelect,
    })
  }

  async findActiveAuthorization(profileId: string): Promise<{ id: string; isActive: boolean } | null> {
    return prisma.backofficeAuthorizedSponsor.findUnique({
      where: { profileId },
      select: { id: true, isActive: true },
    })
  }

  async listActiveAuthorizedProfiles(): Promise<AuthorizedSponsorProfileRow[]> {
    const rows = await prisma.backofficeAuthorizedSponsor.findMany({
      where: { isActive: true },
      select: { profile: { select: profileSelect } },
      orderBy: [{ profile: { fullName: "asc" } }, { profile: { email: "asc" } }],
    })
    return rows.map((row) => row.profile)
  }

  async listAllWithAudit(): Promise<AuthorizedSponsorRecordRow[]> {
    const rows = await prisma.backofficeAuthorizedSponsor.findMany({
      select: recordSelect,
      orderBy: [{ isActive: "desc" }, { grantedAt: "desc" }],
    })
    return rows.map(mapRecord)
  }

  async grant(input: {
    profileId: string
    grantedByProfileId: string
    notes?: string | null
  }): Promise<AuthorizedSponsorRecordRow> {
    const row = await prisma.backofficeAuthorizedSponsor.upsert({
      where: { profileId: input.profileId },
      create: {
        profileId: input.profileId,
        isActive: true,
        grantedByProfileId: input.grantedByProfileId,
        grantedAt: new Date(),
        notes: input.notes ?? null,
      },
      update: {
        isActive: true,
        grantedByProfileId: input.grantedByProfileId,
        grantedAt: new Date(),
        revokedByProfileId: null,
        revokedAt: null,
        notes: input.notes ?? null,
      },
      select: recordSelect,
    })
    return mapRecord(row)
  }

  async revoke(input: {
    profileId: string
    revokedByProfileId: string
  }): Promise<AuthorizedSponsorRecordRow | null> {
    const existing = await prisma.backofficeAuthorizedSponsor.findUnique({
      where: { profileId: input.profileId },
      select: { id: true, isActive: true },
    })
    if (!existing) return null

    const row = await prisma.backofficeAuthorizedSponsor.update({
      where: { profileId: input.profileId },
      data: {
        isActive: false,
        revokedByProfileId: input.revokedByProfileId,
        revokedAt: new Date(),
      },
      select: recordSelect,
    })
    return mapRecord(row)
  }

  async countSponsoredAccounts(profileId: string): Promise<number> {
    return prisma.profile.count({ where: { sponsorMasterId: profileId } })
  }

  async listEligibleMasterProfiles(): Promise<AuthorizedSponsorProfileRow[]> {
    const activeAuthorized = await prisma.backofficeAuthorizedSponsor.findMany({
      where: { isActive: true },
      select: { profileId: true },
    })
    const activeIds = activeAuthorized.map((row) => row.profileId)

    return prisma.profile.findMany({
      where: {
        isMaster: true,
        ...(activeIds.length > 0 ? { id: { notIn: activeIds } } : {}),
      },
      select: profileSelect,
      orderBy: [{ fullName: "asc" }, { email: "asc" }],
    })
  }
}

export const backofficeSponsorAuthorizationRepository = new BackofficeSponsorAuthorizationRepository()
