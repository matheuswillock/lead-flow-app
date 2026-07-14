import type { SubscriptionPlan, SubscriptionStatus } from "@prisma/client"

export interface TeamSummaryRecord {
  id: string
  name: string
  createdAt: Date
  membersCount: number
}

export interface TeamMemberRecord {
  id: string
  teamMemberId: string
  supabaseId: string | null
  fullName: string | null
  email: string
  phone: string | null
  addedAt: Date
  role: string
  googleCalendarConnected: boolean
  googleEmail: string | null
  functions: string[]
  isMaster: boolean
  canCreateAccountUsers: boolean
  canManageAccountTeams: boolean
  canTransferAccountLeads: boolean
  canViewAllTeams: boolean
}

export interface MasterPlatformUserRecord {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  profileIconUrl: string | null
  createdAt: Date
  hasPermanentSubscription: boolean
  hasUnlimitedUsers: boolean
  multiskillEnabled: boolean
  subscriptionPlan: SubscriptionPlan | null
  operatorCount: number
  googleCalendarConnected: boolean
  linkedUsersCount: number
  teamsCount: number
  teams: TeamSummaryRecord[]
}

export interface MasterPlatformUserTypeRecord {
  slug: "common" | "member_pro"
  isExpired: boolean
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
  hasUnlimitedUsers: boolean
  multiskillEnabled: boolean
  subscriptionPlan: SubscriptionPlan | null
  subscriptionStatus: SubscriptionStatus | null
  subscriptionId: string | null
  operatorCount: number
  googleCalendarConnected: boolean
  linkedUsersCount: number
  teamsTotalItems: number
  userType: MasterPlatformUserTypeRecord
  allTeams: Array<{ id: string; name: string; membersCount: number }>
  teams: Array<{
    id: string
    name: string
    createdAt: Date
    membersCount: number
    members: TeamMemberRecord[]
    transferRoutes: Array<{ teamId: string; teamName: string }>
  }>
}

export interface MasterPlatformUserBillingRecord {
  id: string
  fullName: string | null
  email: string
  cpfCnpj: string | null
  phone: string | null
  postalCode: string | null
  address: string | null
  addressNumber: string | null
  neighborhood: string | null
  complement: string | null
  asaasCustomerId: string | null
  asaasSubscriptionId: string | null
  subscriptionStatus: SubscriptionStatus | null
  subscriptionNextDueDate: Date | null
  subscriptionEndDate: Date | null
  subscriptionCycle: string | null
  hasPermanentSubscription: boolean
  hasUnlimitedUsers: boolean
  timezone: string | null
  functions: string[]
}

export interface PlatformUsersFilters {
  name?: string
  email?: string
  team?: string
  plan?: "lifetime" | "monthly" | "trial" | "none"
  userType?: "common" | "member_pro"
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
      hasPermanentSubscription?: boolean
      hasUnlimitedUsers?: boolean
      multiskillEnabled?: boolean
    }
  ): Promise<{ id: string; hasUnlimitedUsers: boolean } | null>

  findMasterUserForDeletion(masterProfileId: string): Promise<MasterUserForDeletionRecord | null>

  deleteMasterUserWithAllMembers(masterProfileId: string): Promise<{
    masterSupabaseId: string | null
    memberSupabaseIds: string[]
  }>

  findDefaultTeamByMasterId(masterProfileId: string): Promise<{ id: string; name: string } | null>

  listTeamsByMasterId(masterProfileId: string): Promise<Array<{ id: string; name: string }> | null>

  findTeamByIdAndMasterId(teamId: string, masterId: string): Promise<{ id: string } | null>

  findTeamMember(teamId: string, profileId: string): Promise<{ id: string } | null>

  findProfileByEmail(email: string): Promise<{
    id: string
    email: string
    fullName: string | null
    supabaseId: string | null
    isMaster: boolean
    managerId: string | null
  } | null>

  profileBelongsToMasterAccount(profileId: string, masterProfileId: string): Promise<boolean>

  createMemberForMaster(
    masterProfileId: string,
    data: {
      fullName: string
      email: string
      phone?: string | null
      role: "manager" | "backoffice" | "operator"
      functions: ("SDR" | "CLOSER")[]
      canCreateAccountUsers?: boolean
      canManageAccountTeams?: boolean
      canTransferAccountLeads?: boolean
    },
    teamId: string
  ): Promise<{ profileId: string; teamMemberId: string }>

  addExistingProfileToTeam(
    profileId: string,
    teamId: string,
    role: "manager" | "backoffice" | "operator",
    functions: ("SDR" | "CLOSER")[],
    permissions?: {
      canCreateAccountUsers: boolean
      canManageAccountTeams: boolean
      canTransferAccountLeads: boolean
    }
  ): Promise<{ teamMemberId: string }>

  createTeamForMaster(
    masterProfileId: string,
    name: string
  ): Promise<{ id: string; name: string }>

  updateTeam(
    teamId: string,
    masterId: string,
    data: { name: string }
  ): Promise<{ id: string } | null>

  syncTeamTransferRoutes(
    teamId: string,
    masterId: string,
    targetTeamIds: string[],
    createdBy: string
  ): Promise<void>

  deleteTeam(teamId: string, masterId: string): Promise<void>

  updateSupabaseIdForProfile(profileId: string, supabaseId: string): Promise<void>

  assertUserSubscriptionCapacity(masterProfileId: string): Promise<void>
}
