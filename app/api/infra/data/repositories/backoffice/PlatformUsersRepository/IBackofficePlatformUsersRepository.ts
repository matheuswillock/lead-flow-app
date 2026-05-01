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
  cpfCnpj: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  complement: string | null
  city: string | null
  state: string | null
  functions: string[]
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

export interface MasterUserForDeletionRecord {
  id: string
  supabaseId: string | null
  fullName: string | null
  email: string
  managers: Array<{ fullName: string | null; email: string }>
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

  updateMasterUserProfile(
    masterProfileId: string,
    data: {
      fullName?: string
      phone?: string | null
      cpfCnpj?: string | null
      postalCode?: string | null
      address?: string | null
      addressNumber?: string | null
      neighborhood?: string | null
      complement?: string | null
      city?: string | null
      state?: string | null
      functions?: string[]
    }
  ): Promise<{ id: string } | null>

  findMasterUserForDeletion(masterProfileId: string): Promise<MasterUserForDeletionRecord | null>

  deleteMasterUserWithAllMembers(masterProfileId: string): Promise<{
    masterSupabaseId: string | null
    memberSupabaseIds: string[]
  }>
}
