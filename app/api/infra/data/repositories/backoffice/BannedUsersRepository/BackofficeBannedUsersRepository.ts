import type { BackofficeBanScope, BackofficeBanStatus, Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import { invalidateAccountAccessStatusCache } from "@/lib/cache/invalidation"
import type {
  ActiveBanAuthRecord,
  BackofficeBannedUserListResult,
  BackofficeBannedUserRecord,
  BanTargetProfile,
  CreateBackofficeBannedUserInput,
  IBackofficeBannedUsersRepository,
} from "./IBackofficeBannedUsersRepository"

const actorSelect = {
  id: true,
  fullName: true,
  email: true,
} as const

const bannedUserSelect = {
  id: true,
  profileId: true,
  supabaseId: true,
  email: true,
  fullName: true,
  reason: true,
  status: true,
  scope: true,
  bannedByProfileId: true,
  bannedAt: true,
  liftedByProfileId: true,
  liftedAt: true,
  liftReason: true,
  bannedByProfile: { select: actorSelect },
  liftedByProfile: { select: actorSelect },
} satisfies Prisma.BackofficeBannedUserSelect

type BannedUserRow = Prisma.BackofficeBannedUserGetPayload<{
  select: typeof bannedUserSelect
}>

function mapRecord(row: BannedUserRow): BackofficeBannedUserRecord {
  return {
    id: row.id,
    profileId: row.profileId,
    supabaseId: row.supabaseId,
    email: row.email,
    fullName: row.fullName,
    reason: row.reason,
    status: row.status,
    scope: row.scope,
    bannedByProfileId: row.bannedByProfileId,
    bannedAt: row.bannedAt,
    liftedByProfileId: row.liftedByProfileId,
    liftedAt: row.liftedAt,
    liftReason: row.liftReason,
    bannedBy: row.bannedByProfile,
    liftedBy: row.liftedByProfile,
  }
}

export class BackofficeBannedUsersRepository implements IBackofficeBannedUsersRepository {
  async findBanTargetProfile(profileId: string): Promise<BanTargetProfile | null> {
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: {
        id: true,
        email: true,
        fullName: true,
        supabaseId: true,
        role: true,
        isMaster: true,
        backofficeUser: { select: { isActive: true } },
      },
    })

    if (!profile) return null

    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      supabaseId: profile.supabaseId,
      role: profile.role,
      isMaster: profile.isMaster,
      isActiveBackofficeUser: Boolean(profile.backofficeUser?.isActive),
    }
  }

  async resolveBanScope(profileId: string, isMaster: boolean): Promise<BackofficeBanScope> {
    if (isMaster) {
      return "ACCOUNT"
    }

    const ownsTeam = await prisma.team.findFirst({
      where: { masterId: profileId },
      select: { id: true },
    })

    return ownsTeam ? "ACCOUNT" : "INDIVIDUAL"
  }

  async findActiveBanById(banId: string): Promise<ActiveBanAuthRecord | null> {
    const row = await prisma.backofficeBannedUser.findUnique({
      where: { id: banId },
      select: {
        id: true,
        status: true,
        supabaseId: true,
        scope: true,
      },
    })

    if (!row || row.status !== "ACTIVE") {
      return null
    }

    return row
  }

  async findActiveByProfileId(profileId: string): Promise<BackofficeBannedUserRecord | null> {
    const row = await prisma.backofficeBannedUser.findFirst({
      where: { profileId, status: "ACTIVE" },
      select: bannedUserSelect,
      orderBy: { bannedAt: "desc" },
    })

    return row ? mapRecord(row) : null
  }

  async list(params: {
    page: number
    pageSize: number
    status?: BackofficeBanStatus | "all"
    query?: string
  }): Promise<BackofficeBannedUserListResult> {
    const page = Math.max(params.page, 1)
    const pageSize = Math.max(params.pageSize, 5)
    const skip = (page - 1) * pageSize

    const and: Prisma.BackofficeBannedUserWhereInput[] = []
    if (params.status && params.status !== "all") {
      and.push({ status: params.status })
    }

    const query = params.query?.trim()
    if (query) {
      and.push({
        OR: [
          { email: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
        ],
      })
    }

    const where: Prisma.BackofficeBannedUserWhereInput =
      and.length > 0 ? { AND: and } : {}

    const [totalItems, rows] = await Promise.all([
      prisma.backofficeBannedUser.count({ where }),
      prisma.backofficeBannedUser.findMany({
        where,
        select: bannedUserSelect,
        orderBy: [{ status: "asc" }, { bannedAt: "desc" }],
        skip,
        take: pageSize,
      }),
    ])

    const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1)

    return {
      items: rows.map(mapRecord),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    }
  }

  async create(input: CreateBackofficeBannedUserInput): Promise<BackofficeBannedUserRecord> {
    const row = await prisma.backofficeBannedUser.create({
      data: {
        profileId: input.profileId,
        supabaseId: input.supabaseId,
        email: input.email,
        fullName: input.fullName,
        reason: input.reason,
        scope: input.scope,
        bannedByProfileId: input.bannedByProfileId,
      },
      select: bannedUserSelect,
    })

    invalidateAccountAccessStatusCache({ accountMasterId: input.profileId })

    return mapRecord(row)
  }

  async lift(params: {
    banId: string
    liftedByProfileId: string
    liftReason: string | null
  }): Promise<BackofficeBannedUserRecord | null> {
    const existing = await this.findActiveBanById(params.banId)
    if (!existing) {
      return null
    }

    const row = await prisma.backofficeBannedUser.update({
      where: { id: params.banId },
      data: {
        status: "LIFTED",
        liftedByProfileId: params.liftedByProfileId,
        liftedAt: new Date(),
        liftReason: params.liftReason,
      },
      select: bannedUserSelect,
    })

    invalidateAccountAccessStatusCache({ accountMasterId: row.profileId })

    return mapRecord(row)
  }

  async findActiveBanProfileIds(profileIds: string[]): Promise<Set<string>> {
    const bans = await this.findActiveBansByProfileIds(profileIds)
    return new Set(bans.keys())
  }

  async findActiveBansByProfileIds(
    profileIds: string[]
  ): Promise<Map<string, BackofficeBannedUserRecord>> {
    if (profileIds.length === 0) {
      return new Map()
    }

    const rows = await prisma.backofficeBannedUser.findMany({
      where: {
        profileId: { in: profileIds },
        status: "ACTIVE",
      },
      select: bannedUserSelect,
      orderBy: { bannedAt: "desc" },
    })

    const map = new Map<string, BackofficeBannedUserRecord>()
    for (const row of rows) {
      if (!map.has(row.profileId)) {
        map.set(row.profileId, mapRecord(row))
      }
    }

    return map
  }
}

export const backofficeBannedUsersRepository = new BackofficeBannedUsersRepository()
