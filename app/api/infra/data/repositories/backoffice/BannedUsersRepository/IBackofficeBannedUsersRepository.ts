import type { BackofficeBanScope, BackofficeBanStatus } from "@prisma/client"

export type BackofficeBannedUserRecord = {
  id: string
  profileId: string
  supabaseId: string | null
  email: string
  fullName: string | null
  reason: string | null
  status: BackofficeBanStatus
  scope: BackofficeBanScope
  bannedByProfileId: string
  bannedAt: Date
  liftedByProfileId: string | null
  liftedAt: Date | null
  liftReason: string | null
  bannedBy: {
    id: string
    fullName: string | null
    email: string
  }
  liftedBy: {
    id: string
    fullName: string | null
    email: string
  } | null
}

export type BackofficeBannedUserListResult = {
  items: BackofficeBannedUserRecord[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export type CreateBackofficeBannedUserInput = {
  profileId: string
  supabaseId: string | null
  email: string
  fullName: string | null
  reason: string | null
  scope: BackofficeBanScope
  bannedByProfileId: string
}

export type BanTargetProfile = {
  id: string
  email: string
  fullName: string | null
  supabaseId: string | null
  role: string
  isMaster: boolean
  isActiveBackofficeUser: boolean
}

export type ActiveBanAuthRecord = {
  id: string
  status: BackofficeBanStatus
  supabaseId: string | null
  scope: BackofficeBanScope
}

export interface IBackofficeBannedUsersRepository {
  findActiveByProfileId(profileId: string): Promise<BackofficeBannedUserRecord | null>
  findActiveBanById(banId: string): Promise<ActiveBanAuthRecord | null>
  findBanTargetProfile(profileId: string): Promise<BanTargetProfile | null>
  resolveBanScope(profileId: string, isMaster: boolean): Promise<BackofficeBanScope>
  list(params: {
    page: number
    pageSize: number
    status?: BackofficeBanStatus | "all"
    query?: string
  }): Promise<BackofficeBannedUserListResult>
  create(input: CreateBackofficeBannedUserInput): Promise<BackofficeBannedUserRecord>
  lift(params: {
    banId: string
    liftedByProfileId: string
    liftReason: string | null
  }): Promise<BackofficeBannedUserRecord | null>
  findActiveBanProfileIds(profileIds: string[]): Promise<Set<string>>
  findActiveBansByProfileIds(profileIds: string[]): Promise<Map<string, BackofficeBannedUserRecord>>
}
