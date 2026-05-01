export type BackofficeAdhesionStatusKey =
  | "pending"
  | "paid"
  | "overdue"
  | "expired"
  | "canceled"

export type BackofficeAdhesionBillingCycleKey = "monthly" | "quarterly" | "semiannual"

export interface BackofficeAdhesionItem {
  id: string
  leadId: string
  leadName: string
  fullName: string
  phone: string
  email: string | null
  sdrBackofficeUserId: string | null
  closerBackofficeUserId: string | null
  status: BackofficeAdhesionStatusKey
  cycle: BackofficeAdhesionBillingCycleKey
  modules: string[]
  extraTeams: number
  extraUsers: number
  monthlyBaseAmount: number
  monthlyExtraTeamsAmount: number
  monthlyExtraUsersAmount: number
  monthlyTotalAmount: number
  totalAmount: number
  expiresAt: string
  createdAt: string
  paidAt: string | null
  billingType: string | null
  asaasPaymentId: string | null
}

export interface BackofficeAdhesionLeadOption {
  id: string
  name: string
  email: string | null
  phone: string | null
  status: string
  sdrBackofficeUserId: string | null
  closerBackofficeUserId: string | null
}

export interface BackofficeAdhesionUserOption {
  id: string
  name: string
  email: string
}

export interface BackofficeAdhesionOptions {
  leads: BackofficeAdhesionLeadOption[]
  sdrOptions: BackofficeAdhesionUserOption[]
  closerOptions: BackofficeAdhesionUserOption[]
}

export interface BackofficeAdhesionFormValues {
  leadId: string
  fullName: string
  phone: string
  cycle: BackofficeAdhesionBillingCycleKey
  extraTeams: number
  extraUsers: number
  sdrBackofficeUserId: string | null
  closerBackofficeUserId: string | null
}

export interface BackofficeAdhesionFilters {
  query: string
  status: BackofficeAdhesionStatusKey | "all"
}

export interface BackofficeAdhesionPagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export interface BackofficeAdhesionListResult {
  items: BackofficeAdhesionItem[]
  pagination: BackofficeAdhesionPagination
}

export interface BackofficeAdhesionCreationResult {
  adhesion: BackofficeAdhesionItem
  publicUrl: string
  expiresAt: string
}

export const BACKOFFICE_ADHESION_STATUS_LABELS: Record<
  BackofficeAdhesionStatusKey,
  string
> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  expired: "Expirado",
  canceled: "Cancelado",
}

export const BACKOFFICE_ADHESION_CYCLE_LABELS: Record<
  BackofficeAdhesionBillingCycleKey,
  string
> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
}
