import type { SubscriptionPlan, UserFunction, UserRole } from "@prisma/client"

export type BackofficeAllUsersRoleFilter = "master" | "manager" | "operator"
export type BackofficeAllUsersPlanFilter = "lifetime" | "monthly" | "trial" | "none"
export type BackofficeAllUsersUserTypeFilter = "common" | "member_pro"

export interface BackofficeAllUsersFiltersInput {
  query?: string
  role?: BackofficeAllUsersRoleFilter
  plan?: BackofficeAllUsersPlanFilter
  userType?: BackofficeAllUsersUserTypeFilter
}

export interface BackofficeAllUsersUserTypeRef {
  slug: "common" | "member_pro"
  label: string
  accessExpiresAt: string | null
  isExpired: boolean
}

export interface BackofficeUpsertUserTypeAssignmentInput {
  userType: "common" | "member_pro"
  accessExpiresAt: Date | null
  assignedByProfileId: string | null
}

export interface BackofficeAllUsersPaginationInput {
  page: number
  pageSize: number
}

export interface BackofficeAllUsersMasterRef {
  id: string
  fullName: string | null
  hasPermanentSubscription: boolean
  subscriptionPlan: SubscriptionPlan | null
  operatorCount: number
}

export interface BackofficeAllUsersListRecord {
  id: string
  supabaseId: string | null
  fullName: string | null
  email: string
  phone: string | null
  role: UserRole
  functions: UserFunction[]
  isMaster: boolean
  googleCalendarConnected: boolean
  createdAt: Date
  master: BackofficeAllUsersMasterRef | null
  userType: BackofficeAllUsersUserTypeRef
}

export interface BackofficeAllUsersDetailRecord extends BackofficeAllUsersListRecord {
  googleEmail: string | null
  teams: Array<{
    id: string
    name: string
    createdAt: Date
    membersCount: number
    masterId: string
    masterFullName: string | null
  }>
}

export interface BackofficeAllUsersListResult {
  items: BackofficeAllUsersListRecord[]
  totalItems: number
}

export interface IBackofficeAllUsersRepository {
  list(
    filters: BackofficeAllUsersFiltersInput,
    pagination: BackofficeAllUsersPaginationInput
  ): Promise<BackofficeAllUsersListResult>

  findDetailById(profileId: string): Promise<BackofficeAllUsersDetailRecord | null>

  findIsMaster(profileId: string): Promise<boolean | null>

  upsertUserTypeAssignment(
    profileId: string,
    data: BackofficeUpsertUserTypeAssignmentInput
  ): Promise<BackofficeAllUsersUserTypeRef>
}
