import type { SubscriptionPlan, UserFunction, UserRole } from "@prisma/client"

export type BackofficeAllUsersRoleFilter = "master" | "manager" | "operator"
export type BackofficeAllUsersPlanFilter = "lifetime" | "monthly" | "trial" | "none"

export interface BackofficeAllUsersFiltersInput {
  query?: string
  role?: BackofficeAllUsersRoleFilter
  plan?: BackofficeAllUsersPlanFilter
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
  fullName: string | null
  email: string
  phone: string | null
  role: UserRole
  functions: UserFunction[]
  isMaster: boolean
  googleCalendarConnected: boolean
  createdAt: Date
  master: BackofficeAllUsersMasterRef | null
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
}
