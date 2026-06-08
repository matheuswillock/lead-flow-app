export type BackofficeAllUsersRole = "manager" | "operator" | "backoffice"
export type BackofficeAllUsersRoleFilter = "master" | "manager" | "operator"
export type BackofficeAllUsersPlanFilter = "lifetime" | "monthly" | "trial" | "none"
export type BackofficeAllUsersUserTypeFilter = "common" | "member_pro"

export interface BackofficeAllUsersUserType {
  slug: "common" | "member_pro"
  label: string
  accessExpiresAt: string | null
  isExpired: boolean
}

export interface BackofficeAllUsersPlan {
  label: string
  amount: number | null
  kind: "lifetime" | "monthly" | "trial" | "none"
}

export interface BackofficeAllUsersMasterRef {
  id: string
  fullName: string | null
  plan: BackofficeAllUsersPlan
}

export interface BackofficeAllUsersFunction {
  name: "SDR" | "CLOSER"
  label: string
}

export interface BackofficeAllUsersItem {
  id: string
  fullName: string | null
  email: string
  phone: string | null
  role: BackofficeAllUsersRole
  functions: BackofficeAllUsersFunction[]
  isMaster: boolean
  googleCalendarConnected: boolean
  createdAt: string
  master: BackofficeAllUsersMasterRef | null
  userType: BackofficeAllUsersUserType
}

export interface BackofficeAllUsersTeamSummary {
  id: string
  name: string
  createdAt: string
  membersCount: number
  masterId: string
  masterFullName: string | null
}

export interface BackofficeAllUsersDetail extends BackofficeAllUsersItem {
  googleEmail: string | null
  teams: BackofficeAllUsersTeamSummary[]
}

export interface BackofficeAllUsersFilters {
  query: string
  role: BackofficeAllUsersRoleFilter | "all"
  plan: BackofficeAllUsersPlanFilter | "all"
  userType: BackofficeAllUsersUserTypeFilter | "all"
}

export interface BackofficePagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface BackofficeAllUsersListResult {
  items: BackofficeAllUsersItem[]
  pagination: BackofficePagination
}
