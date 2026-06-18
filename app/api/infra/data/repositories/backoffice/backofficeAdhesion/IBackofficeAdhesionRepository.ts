import type {
  BackofficeAdhesion,
  BackofficeAdhesionBillingCycle,
  BackofficeAdhesionPlan,
  BackofficeAdhesionStatus,
  BackofficeLead,
  BackofficeUser,
  Profile,
} from "@prisma/client"

export type BackofficeAdhesionUserRelation = Pick<
  BackofficeUser,
  "id" | "email" | "isActive" | "isSdr" | "isCloser"
> & {
  profile: Pick<Profile, "fullName" | "email">
}

export type BackofficeAdhesionLeadRelation = Pick<
  BackofficeLead,
  | "id"
  | "name"
  | "email"
  | "phone"
  | "cpfCnpj"
  | "status"
  | "sdrBackofficeUserId"
  | "closerBackofficeUserId"
>

export type BackofficeAdhesionWithRelations = BackofficeAdhesion & {
  tokenPlain?: string | null
  lead: BackofficeAdhesionLeadRelation
  sdrBackofficeUser: BackofficeAdhesionUserRelation | null
  closerBackofficeUser: BackofficeAdhesionUserRelation | null
}

export interface CreateBackofficeAdhesionInput {
  leadId: string
  fullName: string
  phone: string
  cpfCnpj?: string | null
  billingType?: string | null
  plan: BackofficeAdhesionPlan
  cycle: BackofficeAdhesionBillingCycle
  modules: string[]
  extraTeams: number
  extraUsers: number
  monthlyBaseAmount: number
  monthlyExtraTeamsAmount: number
  monthlyExtraUsersAmount: number
  monthlyTotalAmount: number
  totalAmount: number
  tokenHash: string
  tokenPreview: string
  tokenPlain?: string | null
  expiresAt: Date
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  createdByBackofficeUserId?: string | null
  requestedUserTypeSlug?: "common" | "member_pro" | null
  requestedMemberProAccessExpiresAt?: Date | null
  additionalUsersData?: unknown[]
  additionalTeamsData?: unknown[]
}

export interface UpdateBackofficeAdhesionInput {
  fullName?: string
  phone?: string
  email?: string | null
  cpfCnpj?: string | null
  cycle?: BackofficeAdhesionBillingCycle
  modules?: string[]
  extraTeams?: number
  extraUsers?: number
  monthlyBaseAmount?: number
  monthlyExtraTeamsAmount?: number
  monthlyExtraUsersAmount?: number
  monthlyTotalAmount?: number
  totalAmount?: number
  sdrBackofficeUserId?: string | null
  closerBackofficeUserId?: string | null
  billingType?: string | null
  status?: BackofficeAdhesionStatus
  tokenHash?: string
  tokenPreview?: string
  tokenPlain?: string | null
  expiresAt?: Date
}

export interface UpdateBackofficeAdhesionCheckoutInput {
  fullName?: string
  phone?: string
  email?: string
  cpfCnpj?: string
  postalCode?: string
  address?: string
  addressNumber?: string
  neighborhood?: string
  complement?: string | null
  city?: string
  state?: string
  asaasCustomerId?: string
  asaasPaymentId?: string | null
  asaasInstallmentId?: string | null
  installmentCount?: number | null
  billingType?: string
  paymentDueDate?: Date | null
  invoiceUrl?: string | null
  bankSlipUrl?: string | null
  pixQrCode?: string | null
  pixPayload?: string | null
}

export interface MarkBackofficeAdhesionExternalPaidInput {
  fullName: string
  phone: string
  email: string
  cpfCnpj?: string | null
  paidAt: Date
  asaasCustomerId?: string | null
}

export interface CreateBackofficeAdhesionManagerProfileInput {
  supabaseId: string
  fullName: string
  phone: string
  email: string
  asaasCustomerId?: string | null
  cpfCnpj?: string | null
  subscriptionId?: string | null
  operatorCount: number
  subscriptionStartDate: Date
  postalCode?: string | null
  address?: string | null
  addressNumber?: string | null
  neighborhood?: string | null
  complement?: string | null
  city?: string | null
  state?: string | null
}

export interface ListBackofficeAdhesionsInput {
  page: number
  pageSize: number
  status?: BackofficeAdhesionStatus
  query?: string
}

export interface ListBackofficeAdhesionsResult {
  items: BackofficeAdhesionWithRelations[]
  totalItems: number
}

export interface BackofficeAdhesionOptions {
  leads: BackofficeAdhesionLeadRelation[]
  users: BackofficeAdhesionUserRelation[]
}

export interface IBackofficeAdhesionRepository {
  createAndMoveLeadToAdhesion(
    data: CreateBackofficeAdhesionInput
  ): Promise<BackofficeAdhesionWithRelations>
  list(input: ListBackofficeAdhesionsInput): Promise<ListBackofficeAdhesionsResult>
  findById(id: string): Promise<BackofficeAdhesionWithRelations | null>
  findByLeadId(leadId: string): Promise<BackofficeAdhesionWithRelations | null>
  findByAsaasPaymentId(paymentId: string): Promise<BackofficeAdhesionWithRelations | null>
  findByTokenHash(tokenHash: string): Promise<BackofficeAdhesionWithRelations | null>
  update(
    id: string,
    data: UpdateBackofficeAdhesionInput
  ): Promise<BackofficeAdhesionWithRelations>
  updateCheckoutData(
    id: string,
    data: UpdateBackofficeAdhesionCheckoutInput
  ): Promise<BackofficeAdhesionWithRelations>
  markExternalPaid(
    id: string,
    data: MarkBackofficeAdhesionExternalPaidInput
  ): Promise<BackofficeAdhesionWithRelations>
  updateStatus(
    id: string,
    status: BackofficeAdhesionStatus,
    dates?: { paidAt?: Date; overdueAt?: Date; canceledAt?: Date }
  ): Promise<BackofficeAdhesionWithRelations>
  markAccountCreated(
    id: string,
    data: { createdProfileId: string; createdSupabaseId: string }
  ): Promise<BackofficeAdhesionWithRelations>
  findProfileIdByEmail(email: string): Promise<string | null>
  createPaidManagerProfile(
    data: CreateBackofficeAdhesionManagerProfileInput
  ): Promise<{ profileId: string; supabaseId: string }>
  activateCreatedProfileSubscription(
    profileId: string,
    data: {
      subscriptionEndDate: Date
      subscriptionCycle: string
      subscriptionNextDueDate: Date
    }
  ): Promise<void>
  upsertProfileSubscription(data: {
    profileId: string
    adhesionId: string
    productId: string
    subscriptionStatus: string
    subscriptionPlan: string
    subscriptionCycle: string
    subscriptionStartDate: Date
    subscriptionEndDate: Date
    subscriptionNextDueDate: Date
  }): Promise<void>
  clearPaymentArtifacts(id: string): Promise<BackofficeAdhesionWithRelations>
  getOptions(): Promise<BackofficeAdhesionOptions>
  cancelAdhesionAndRestoreLead(
    adhesionId: string,
    previousLeadStatus: import("@prisma/client").BackofficeLeadStatus
  ): Promise<void>
}
