import type { SubscriptionPlan } from "@prisma/client"

export interface TeamSummaryRecord {
  id: string
  name: string
  createdAt: Date
  membersCount: number
}

export interface TeamMemberRecord {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  addedAt: Date
  role: string
  functions: string[]
}

export interface MasterPlatformUserRecord {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  profileIconUrl: string | null
  createdAt: Date
  hasPermanentSubscription: boolean
  subscriptionPlan: SubscriptionPlan | null
  operatorCount: number
  linkedUsersCount: number
  teamsCount: number
  teams: TeamSummaryRecord[]
}

export interface MasterPlatformUserDetailsRecord {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  profileIconUrl: string | null
  createdAt: Date
  hasPermanentSubscription: boolean
  subscriptionPlan: SubscriptionPlan | null
  operatorCount: number
  linkedUsersCount: number
  teamsTotalItems: number
  teams: Array<{
    id: string
    name: string
    createdAt: Date
    membersCount: number
    members: TeamMemberRecord[]
  }>
}

export interface MasterPlatformUserBillingRecord {
  id: string
  fullName: string | null
  email: string
  asaasCustomerId: string | null
  hasPermanentSubscription: boolean
}

export interface PlatformUsersFilters {
  name?: string
  email?: string
  team?: string
}

export interface RepositoryPaginationParams {
  page: number
  pageSize: number
}

export interface RepositoryPaginatedResult<T> {
  items: T[]
  totalItems: number
}

export interface IBackofficePlatformUsersRepository {
  findMasterUsersWithFilters(
    filters: PlatformUsersFilters | undefined,
    pagination: RepositoryPaginationParams
  ): Promise<RepositoryPaginatedResult<MasterPlatformUserRecord>>

  findMasterUserDetailsById(
    masterProfileId: string,
    options: {
      query?: string
      page: number
      pageSize: number
    }
  ): Promise<MasterPlatformUserDetailsRecord | null>

  findMasterUserBillingById(masterProfileId: string): Promise<MasterPlatformUserBillingRecord | null>
}
