import type {
  BackofficeAdhesionBillingCycle,
  BackofficeAdhesionStatus,
} from "@prisma/client"
import type { BackofficeAdhesionTokenValidationStatus } from "@/lib/backoffice-adhesions/adhesion-token-validation"

export interface BackofficeAdhesionAdditionalUser {
  name: string
  email: string
  role: "manager" | "backoffice" | "operator"
  functions: ("SDR" | "CLOSER")[]
}

export interface BackofficeAdhesionAdditionalTeam {
  name: string
}

export interface BackofficeAdhesionCreateInput {
  leadId: string
  fullName: string
  phone: string
  email?: string | null
  cpfCnpj?: string | null
  cycle: BackofficeAdhesionBillingCycle
  extraTeams: number
  extraUsers: number
  billingType?: "PIX" | "CREDIT_CARD" | "EXTERNAL" | null
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  activationMode?: "checkout" | "external_paid"
  userType?: "common" | "member_pro"
  accessExpiresAt?: string | null
  additionalUsers?: BackofficeAdhesionAdditionalUser[]
  additionalTeams?: BackofficeAdhesionAdditionalTeam[]
}

export interface BackofficeAdhesionUpdateInput {
  fullName?: string
  phone?: string
  email?: string | null
  cpfCnpj?: string | null
  cycle?: BackofficeAdhesionBillingCycle
  extraTeams?: number
  extraUsers?: number
  billingType?: "PIX" | "CREDIT_CARD" | "EXTERNAL" | null
  activationMode?: "checkout" | "external_paid"
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
}

export interface BackofficeAdhesionCheckoutInput {
  fullName: string
  email: string
  phone: string
  cpfCnpj: string
  postalCode: string
  address: string
  addressNumber: string
  neighborhood: string
  complement?: string | null
  city: string
  state: string
  billingType: "PIX" | "CREDIT_CARD"
  installments?: number
  creditCard?: {
    holderName: string
    number: string
    expiryMonth: string
    expiryYear: string
    ccv: string
  }
  remoteIp?: string
}

export interface BackofficeAdhesionDTO {
  id: string
  leadId: string
  leadName: string
  fullName: string
  phone: string
  cpfCnpj: string | null
  email: string | null
  sdrBackofficeUserId: string | null
  closerBackofficeUserId: string | null
  status: BackofficeAdhesionStatus
  cycle: BackofficeAdhesionBillingCycle
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

export interface BackofficeAdhesionPublicDTO {
  id: string
  fullName: string
  phone: string
  cpfCnpj: string | null
  email: string | null
  billingType: "PIX" | "CREDIT_CARD" | null
  status: BackofficeAdhesionStatus
  cycle: BackofficeAdhesionBillingCycle
  cycleLabel: string
  cycleMonths: number
  modules: string[]
  extraTeams: number
  extraUsers: number
  monthlyBaseAmount: number
  monthlyExtraTeamsAmount: number
  monthlyExtraUsersAmount: number
  monthlyTotalAmount: number
  totalAmount: number
  maxInstallments: number
  pixMonthlyTotalAmount: number
  pixTotalAmount: number
  creditCardMonthlyTotalAmount: number
  creditCardTotalAmount: number
  maxCardInstallments: number
  createdAt: string
  paidAt: string | null
  expiresAt: string
}

export interface BackofficeAdhesionPaymentDTO {
  adhesionId: string
  paymentId: string | null
  status: BackofficeAdhesionStatus
  billingType: string | null
  amount: number
  invoiceUrl: string | null
  bankSlipUrl: string | null
  pix?: {
    encodedImage: string
    payload: string
    expirationDate: string | null
  }
  boleto?: {
    bankSlipUrl: string | null
    identificationField: string
    barCode: string
    dueDate: string | null
  }
}

export interface BackofficeAdhesionOptionsDTO {
  leads: Array<{
    id: string
    name: string
    email: string | null
    phone: string | null
    cpfCnpj: string | null
    status: string
    sdrBackofficeUserId: string | null
    closerBackofficeUserId: string | null
  }>
  sdrOptions: Array<{ id: string; name: string; email: string }>
  closerOptions: Array<{ id: string; name: string; email: string }>
  pricing: {
    cycles: Record<
      BackofficeAdhesionBillingCycle,
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

export interface BackofficeAdhesionListDTO {
  items: BackofficeAdhesionDTO[]
  pagination: {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
    hasNextPage: boolean
    hasPreviousPage: boolean
  }
}

export interface BackofficeAdhesionCreationResult {
  adhesion: BackofficeAdhesionDTO
  publicUrl: string | null
  expiresAt: string
  activationMode?: "checkout" | "external_paid"
}


export interface BackofficeAdhesionTokenError {
  tokenStatus: Exclude<BackofficeAdhesionTokenValidationStatus, "valid">
}

export interface BackofficeAdhesionPaymentWebhookInput {
  id?: string
  status?: string
  billingType?: string
  customer?: string
  externalReference?: string
  invoiceUrl?: string
  bankSlipUrl?: string
  dueDate?: string
  paymentDate?: string
  clientPaymentDate?: string
  confirmedDate?: string
  value?: number
}

export interface IBackofficeAdhesionService {
  list(input: {
    page: number
    pageSize: number
    status?: BackofficeAdhesionStatus
    query?: string
  }): Promise<BackofficeAdhesionListDTO>
  getOptions(): Promise<BackofficeAdhesionOptionsDTO>
  create(
    input: BackofficeAdhesionCreateInput,
    createdByBackofficeUserId: string | null
  ): Promise<BackofficeAdhesionCreationResult>
  update(id: string, input: BackofficeAdhesionUpdateInput): Promise<BackofficeAdhesionDTO>
  deletePending(id: string): Promise<void>
  resend(id: string): Promise<BackofficeAdhesionCreationResult>
  resendInvite(id: string): Promise<{ email: string }>
  getPublicUrl(id: string): Promise<{ publicUrl: string; expiresAt: string }>
  getPublicDetails(token: string): Promise<BackofficeAdhesionPublicDTO | BackofficeAdhesionTokenError>
  createCheckout(
    token: string,
    input: BackofficeAdhesionCheckoutInput
  ): Promise<BackofficeAdhesionPaymentDTO | BackofficeAdhesionTokenError>
  getPaymentStatus(
    token: string,
    options?: { sync?: boolean }
  ): Promise<BackofficeAdhesionPaymentDTO | BackofficeAdhesionTokenError>
  processPaymentWebhook(
    event: string,
    payment: BackofficeAdhesionPaymentWebhookInput
  ): Promise<{ processed: boolean; adhesionId?: string }>
}
