export interface BackofficeAdhesionAdditionalUser {
  name: string
  email: string
  role: "manager" | "backoffice" | "operator"
  functions: ("SDR" | "CLOSER")[]
}

export interface BackofficeAdhesionAdditionalTeam {
  name: string
}

export type BackofficeAdhesionStatusKey =
  | "pending"
  | "paid"
  | "overdue"
  | "expired"
  | "canceled"

export type BackofficeAdhesionBillingCycleKey = "monthly" | "quarterly" | "semiannual" | "annual"

export interface BackofficeAdhesionItem {
  id: string
  leadId: string
  leadName: string
  fullName: string
  phone: string
  email: string | null
  cpfCnpj: string | null
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
  productId: string | null
  multiskillEnabled?: boolean
}

export interface BackofficeAdhesionProductVariant {
  id: string
  name: string
  featureSlug: string
  isDefault: boolean
  pricesByCycle: Record<
    BackofficeAdhesionBillingCycleKey,
    {
      pixMonthlyPrice: number | null
      cardMonthlyPrice: number | null
    }
  >
}

export interface BackofficeAdhesionLeadOption {
  id: string
  name: string
  email: string | null
  phone: string | null
  cpfCnpj: string | null
  status: string
  sdrBackofficeUserId: string | null
  closerBackofficeUserId: string | null
}

export interface BackofficeAdhesionUserOption {
  id: string
  name: string
  email: string
}

export interface BackofficeAdhesionSponsorOption {
  id: string
  name: string
  email: string
}

export interface BackofficeAdhesionOptions {
  leads: BackofficeAdhesionLeadOption[]
  sdrOptions: BackofficeAdhesionUserOption[]
  closerOptions: BackofficeAdhesionUserOption[]
  sponsorOptions: BackofficeAdhesionSponsorOption[]
  productVariants: BackofficeAdhesionProductVariant[]
  pricing: {
    cycles: Record<
      BackofficeAdhesionBillingCycleKey,
      {
        baseMonthlyPrice: number
        extraTeamPrice: number
        extraUserPrice: number
        pixBaseMonthlyPrice: number | null
        cardBaseMonthlyPrice: number | null
      }
    >
  }
}

export interface BackofficeAdhesionFormValues {
  leadId: string
  fullName: string
  phone: string
  email: string
  cpfCnpj: string
  productId: string
  cycle: BackofficeAdhesionBillingCycleKey
  extraTeams: number
  extraUsers: number
  billingType: "PIX" | "CREDIT_CARD" | "EXTERNAL" | null
  sdrBackofficeUserId: string | null
  closerBackofficeUserId: string | null
  activationMode: "checkout" | "external_paid"
  userType: "common" | "member_pro" | "associate" | "guest"
  memberProAccessDays: string
  sponsorMasterId: string | null
  multiskillEnabled: boolean
  additionalUsers: BackofficeAdhesionAdditionalUser[]
  additionalTeams: BackofficeAdhesionAdditionalTeam[]
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
  publicUrl: string | null
  expiresAt: string
  activationMode?: "checkout" | "external_paid"
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
  annual: "Anual",
}
