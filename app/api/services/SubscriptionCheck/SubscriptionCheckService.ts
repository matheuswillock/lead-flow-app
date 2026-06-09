import type { ProfileSubscription } from '@prisma/client'
import type { ISubscriptionRepository, ProfileWithSubscription } from '../../infra/data/repositories/subscription/ISubscriptionRepository'
import type { CheckSubscriptionResult, ISubscriptionCheckService } from './ISubscriptionCheckService'

function resolveSubId(p: ProfileWithSubscription): string | null | undefined {
  return p.profileSubscription?.asaasSubscriptionId ?? p.subscriptionId
}

function resolveSubStatus(p: ProfileWithSubscription): ProfileSubscription['subscriptionStatus'] | null | undefined {
  return p.profileSubscription?.subscriptionStatus ?? p.subscriptionStatus
}

function resolveSubPlan(p: ProfileWithSubscription) {
  return p.profileSubscription?.subscriptionPlan ?? p.subscriptionPlan
}

function resolveSubStartDate(p: ProfileWithSubscription) {
  return p.profileSubscription?.subscriptionStartDate ?? p.subscriptionStartDate
}

function resolveSubEndDate(p: ProfileWithSubscription) {
  return p.profileSubscription?.subscriptionEndDate ?? p.subscriptionEndDate
}

function resolveHasPermanent(p: ProfileWithSubscription) {
  return p.profileSubscription?.hasPermanentSubscription ?? p.hasPermanentSubscription
}

export class SubscriptionCheckService implements ISubscriptionCheckService {
  constructor(private subscriptionRepository: ISubscriptionRepository) {}

  async checkActiveSubscription(email?: string, phone?: string, cpfCnpj?: string): Promise<CheckSubscriptionResult> {
    console.info('🔍 [SubscriptionCheckService] Verificando assinatura:', {
      email: email || 'não fornecido',
      phone: phone || 'não fornecido',
      cpfCnpj: cpfCnpj ? `${cpfCnpj?.substring(0, 3)}***` : 'não fornecido',
    })

    const profile = await this.subscriptionRepository.findProfileByEmailOrPhone(email, phone, cpfCnpj)

    if (!profile) {
      console.info('✅ [SubscriptionCheckService] Usuário não encontrado')
      return { success: true, hasActiveSubscription: false, userExists: false }
    }

    if (resolveHasPermanent(profile)) {
      return {
        success: true,
        hasActiveSubscription: true,
        userExists: true,
        isPermanent: true,
        matchSource: email && profile.email === email ? 'email' : phone && profile.phone === phone ? 'phone' : 'document',
        matchedIdentifier: email || phone || cpfCnpj,
        userId: profile.supabaseId,
        userRole: profile.isMaster ? 'master' : (profile.role ?? undefined),
        subscription: { id: 'PERMANENT', status: 'active', plan: 'Assinatura Permanente' },
      }
    }

    let matchSource: 'email' | 'phone' | 'document' | undefined
    let matchedIdentifier: string | undefined
    if (email && profile.email === email) {
      matchSource = 'email'; matchedIdentifier = email
    } else if (phone && profile.phone === phone) {
      matchSource = 'phone'; matchedIdentifier = phone
    } else if (cpfCnpj && profile.cpfCnpj === cpfCnpj) {
      matchSource = 'document'; matchedIdentifier = cpfCnpj
    }

    if (profile.isMaster) {
      const subId = resolveSubId(profile)
      const isActive = resolveSubStatus(profile) === 'active'

      if (subId && isActive) {
        console.info('✅ [SubscriptionCheckService] Master com assinatura ativa')
        return {
          success: true,
          hasActiveSubscription: true,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          subscription: {
            id: subId,
            status: resolveSubStatus(profile) ?? null,
            startDate: resolveSubStartDate(profile),
            endDate: resolveSubEndDate(profile),
            plan: resolveSubPlan(profile),
            operatorCount: profile.operatorCount,
          },
        }
      }

      const msg = subId && !isActive ? 'Master com assinatura inativa' : 'Master sem assinatura'
      console.warn(`⚠️ [SubscriptionCheckService] ${msg}`)
      return {
        success: true,
        hasActiveSubscription: false,
        userExists: true,
        matchSource,
        matchedIdentifier,
        userId: profile.supabaseId,
        subscription: subId ? { id: subId, status: resolveSubStatus(profile) ?? null } : undefined,
      }
    }

    if (profile.managerId) {
      console.info('🔍 [SubscriptionCheckService] Não é master, buscando assinatura do manager:', profile.managerId)
      const manager = await this.subscriptionRepository.findProfileById(profile.managerId)

      if (!manager) {
        console.error('❌ [SubscriptionCheckService] Manager não encontrado')
        return { success: true, hasActiveSubscription: false, userExists: true, matchSource, matchedIdentifier, userId: profile.supabaseId, userRole: profile.role ?? undefined }
      }

      const subId = resolveSubId(manager)
      const isActive = resolveSubStatus(manager) === 'active'

      if (subId && isActive) {
        console.info('✅ [SubscriptionCheckService] Manager tem assinatura ativa')
        return {
          success: true,
          hasActiveSubscription: true,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          userRole: profile.role ?? undefined,
          subscription: {
            id: subId,
            status: resolveSubStatus(manager) ?? null,
            startDate: resolveSubStartDate(manager),
            endDate: resolveSubEndDate(manager),
            plan: resolveSubPlan(manager),
            operatorCount: manager.operatorCount,
          },
        }
      }

      const msg = subId && !isActive ? 'Manager com assinatura inativa' : 'Manager sem assinatura'
      console.warn(`⚠️ [SubscriptionCheckService] ${msg}`)
      return {
        success: true,
        hasActiveSubscription: false,
        userExists: true,
        matchSource,
        matchedIdentifier,
        userId: profile.supabaseId,
        userRole: profile.role ?? undefined,
        subscription: subId ? { id: subId, status: resolveSubStatus(manager) ?? null } : undefined,
      }
    }

    console.warn('⚠️ [SubscriptionCheckService] Usuário sem manager definido e não é master')
    return { success: true, hasActiveSubscription: false, userExists: true, matchSource, matchedIdentifier, userId: profile.supabaseId, userRole: profile.role ?? undefined }
  }
}
