export type BackofficeAnathemaStatus = "ACTIVE" | "LIFTED"
export type BackofficeAnathemaScope = "INDIVIDUAL" | "ACCOUNT"
export type BackofficeAnathemaStatusFilter = BackofficeAnathemaStatus | "all"

export interface BackofficeAnathemaActor {
  id: string
  fullName: string | null
  email: string
}

export interface BackofficeAnathemaItem {
  id: string
  profileId: string
  supabaseId: string | null
  email: string
  fullName: string | null
  reason: string | null
  status: BackofficeAnathemaStatus
  scope: BackofficeAnathemaScope
  bannedAt: string
  liftedAt: string | null
  liftReason: string | null
  bannedBy: BackofficeAnathemaActor
  liftedBy: BackofficeAnathemaActor | null
}

export interface BackofficeAnathemasListResult {
  items: BackofficeAnathemaItem[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface BackofficeAnathemasFilters {
  query: string
  status: BackofficeAnathemaStatusFilter
}
