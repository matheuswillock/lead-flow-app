import type { ISubscriptionRepository, ProfileWithSubscription } from './ISubscriptionRepository'
import prisma from '../../prisma'

const profileSelect = {
  select: {
    id: true,
    supabaseId: true,
    email: true,
    phone: true,
    cpfCnpj: true,
    isMaster: true,
    role: true,
    managerId: true,
    operatorCount: true,
    hasPermanentSubscription: true,
    subscriptionId: true,
    subscriptionStatus: true,
    subscriptionPlan: true,
    subscriptionStartDate: true,
    subscriptionEndDate: true,
    subscription: {
      select: {
        asaasSubscriptionId: true,
        subscriptionStatus: true,
        subscriptionPlan: true,
        subscriptionStartDate: true,
        subscriptionEndDate: true,
        hasPermanentSubscription: true,
      },
    },
  },
} as const

type RawResult = {
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
  subscriptionStatus: ProfileWithSubscription['subscriptionStatus']
  subscriptionPlan: ProfileWithSubscription['subscriptionPlan']
  subscriptionStartDate: Date | null
  subscriptionEndDate: Date | null
  subscription: ProfileWithSubscription['profileSubscription']
}

function mapResult(raw: RawResult | null): ProfileWithSubscription | null {
  if (!raw) return null
  const { subscription, ...profile } = raw
  return { ...profile, profileSubscription: subscription }
}

export class SubscriptionRepository implements ISubscriptionRepository {
  async findProfileByEmailOrPhone(email?: string, phone?: string, cpfCnpj?: string): Promise<ProfileWithSubscription | null> {
    const orConditions: Array<{ email?: string; phone?: string; cpfCnpj?: string }> = []
    if (email) orConditions.push({ email })
    if (phone) orConditions.push({ phone })
    if (cpfCnpj) orConditions.push({ cpfCnpj })
    if (orConditions.length === 0) return null

    const raw = await prisma.profile.findFirst({
      where: { OR: orConditions },
      ...profileSelect,
    })
    return mapResult(raw as RawResult | null)
  }

  async findProfileById(id: string): Promise<ProfileWithSubscription | null> {
    const raw = await prisma.profile.findUnique({
      where: { id },
      ...profileSelect,
    })
    return mapResult(raw as RawResult | null)
  }
}
