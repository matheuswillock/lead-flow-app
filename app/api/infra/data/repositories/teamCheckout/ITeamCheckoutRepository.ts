import type { Prisma, SubscriptionStatus, UserFunction, UserRole } from "@prisma/client"

export interface TeamCheckoutRequesterProfile {
  id: string
  fullName: string | null
  email: string
  functions: UserFunction[]
}

export interface TeamCheckoutMasterProfile {
  id: string
  fullName: string | null
  email: string
  hasPermanentSubscription: boolean
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
  timezone: string | null
}

export interface CreateTeamWithMemberInput {
  masterId: string
  teamName: string
  memberProfileId: string
  memberRole: UserRole
  memberFunctions: UserFunction[]
}

export interface ITeamCheckoutRepository {
  findRequesterProfile(profileId: string): Promise<TeamCheckoutRequesterProfile | null>
  findMasterProfile(masterId: string): Promise<TeamCheckoutMasterProfile | null>
  /** Cria o time e adiciona o solicitante como membro, sem cobrança (bypass/billingDelta=0). */
  createTeamWithMember(input: CreateTeamWithMemberInput): Promise<{ teamId: string }>
  /** Cria a PendingAction de cobrança quando billingDelta > 0 (checkout assíncrono). */
  createPendingAction(masterId: string, payload: Prisma.InputJsonObject): Promise<{ id: string }>
}
