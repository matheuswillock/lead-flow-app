export interface TeamSummaryItem {
  id: string
  name: string
  createdAt: string
  membersCount: number
}

export interface BackofficeClientItem {
  id: string
  fullName: string
  email: string
  phone: string | null
  profileIconUrl: string | null
  createdAt: string
  teamsCount: number
  linkedUsersCount: number
  plan: {
    label: string
    amount: number | null
    kind: "lifetime" | "monthly" | "trial" | "none"
  }
  teams: TeamSummaryItem[]
}

export type BackofficeClientsPlanFilter = "lifetime" | "monthly" | "trial" | "none"
export type BackofficeClientsUserTypeFilter = "common" | "member_pro"

export interface BackofficeClientsFilters {
  query: string
  plan: BackofficeClientsPlanFilter | "all"
  userType: BackofficeClientsUserTypeFilter | "all"
}

export interface BackofficePagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface BackofficeClientsListResult {
  items: BackofficeClientItem[]
  pagination: BackofficePagination
}
