import type { SubscriptionPlan, SubscriptionStatus } from '@prisma/client'

export type ProfileWithSubscription = {
  id: string
  supabaseId: string
  email: string | null
  phone: string | null
  cpfCnpj: string | null
  isMaster: boolean
  role: string | null
  managerId: string | null
  operatorCount: number
  hasPermanentSubscription: boolean
  subscriptionId: string | null
  subscriptionStatus: SubscriptionStatus | null
  subscriptionPlan: SubscriptionPlan | null
  subscriptionStartDate: Date | null
  subscriptionEndDate: Date | null
  profileSubscription: {
    asaasSubscriptionId: string | null
    subscriptionStatus: SubscriptionStatus | null
    subscriptionPlan: SubscriptionPlan | null
    subscriptionStartDate: Date | null
    subscriptionEndDate: Date | null
    hasPermanentSubscription: boolean
  } | null
}

export interface ISubscriptionRepository {
  findProfileByEmailOrPhone(email?: string, phone?: string, cpfCnpj?: string): Promise<ProfileWithSubscription | null>
  findProfileById(id: string): Promise<ProfileWithSubscription | null>
}
