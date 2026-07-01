import { ISubscriptionRepository } from '../../infra/data/repositories/subscription/ISubscriptionRepository';
import { CheckSubscriptionResult, ISubscriptionCheckService } from './ISubscriptionCheckService';
import { isAccountSubscriptionActive } from '@/lib/subscription/isAccountSubscriptionActive';
import { isAccountMasterBanned } from '@/lib/account/isAccountMasterBanned';

export class SubscriptionCheckService implements ISubscriptionCheckService {
  constructor(private subscriptionRepository: ISubscriptionRepository) {}

  private async hasActiveGuestMembership(profileId: string): Promise<boolean> {
    const masterIds = await this.subscriptionRepository.listDistinctMembershipMasterIds(profileId);

    for (const masterId of masterIds) {
      if (masterId === profileId) {
        continue;
      }

      if (await isAccountMasterBanned(masterId)) {
        continue;
      }

      if (await isAccountSubscriptionActive(masterId)) {
        return true;
      }
    }

    return false;
  }

  async checkActiveSubscription(email?: string, phone?: string, cpfCnpj?: string): Promise<CheckSubscriptionResult> {
    console.info('🔍 [SubscriptionCheckService] Verificando assinatura:', {
      email: email || 'não fornecido',
      phone: phone || 'não fornecido',
      cpfCnpj: cpfCnpj ? `${cpfCnpj?.substring(0, 3)}***` : 'não fornecido',
    });

    const profile = await this.subscriptionRepository.findProfileByEmailOrPhone(email, phone, cpfCnpj);

    if (!profile) {
      console.info('✅ [SubscriptionCheckService] Usuário não encontrado');
      return {
        success: true,
        hasActiveSubscription: false,
        userExists: false,
      };
    }

    if (profile.hasPermanentSubscription) {
      return {
        success: true,
        hasActiveSubscription: true,
        userExists: true,
        isPermanent: true,
        matchSource: email && profile.email === email ? 'email' : phone && profile.phone === phone ? 'phone' : 'document',
        matchedIdentifier: email || phone || cpfCnpj,
        userId: profile.supabaseId,
        userRole: profile.isMaster ? 'master' : profile.role,
        subscription: {
          id: 'PERMANENT',
          status: 'active',
          plan: 'Assinatura Permanente',
        },
      };
    }

    let matchSource: 'email' | 'phone' | 'document' | undefined;
    let matchedIdentifier: string | undefined;
    if (email && profile.email === email) {
      matchSource = 'email';
      matchedIdentifier = email;
    } else if (phone && profile.phone === phone) {
      matchSource = 'phone';
      matchedIdentifier = phone;
    } else if ((cpfCnpj as { cpfCnpj?: string | null }) && (profile as { cpfCnpj?: string | null }).cpfCnpj === cpfCnpj) {
      matchSource = 'document';
      matchedIdentifier = cpfCnpj;
    }

    if (profile.isMaster) {
      if (await isAccountMasterBanned(profile.id)) {
        const hasGuestAccess = await this.hasActiveGuestMembership(profile.id);
        if (hasGuestAccess) {
          return {
            success: true,
            hasActiveSubscription: true,
            userExists: true,
            matchSource,
            matchedIdentifier,
            userId: profile.supabaseId,
            userRole: 'master',
          };
        }

        return {
          success: true,
          hasActiveSubscription: false,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          userRole: 'master',
        };
      }

      const hasSubscription = !!profile.subscriptionId;
      const isActive = profile.subscriptionStatus === 'active';

      if (hasSubscription && isActive) {
        console.info('✅ [SubscriptionCheckService] Master com assinatura ativa');
        return {
          success: true,
          hasActiveSubscription: true,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          subscription: {
            id: profile.subscriptionId,
            status: profile.subscriptionStatus,
            startDate: profile.subscriptionStartDate,
            endDate: profile.subscriptionEndDate,
            plan: profile.subscriptionPlan,
            operatorCount: profile.operatorCount,
          },
        };
      }

      const message = hasSubscription && !isActive
        ? 'Master com assinatura inativa'
        : 'Master sem assinatura';

      console.warn(`⚠️ [SubscriptionCheckService] ${message}`);

      const hasGuestAccess = await this.hasActiveGuestMembership(profile.id);
      if (hasGuestAccess) {
        console.info('✅ [SubscriptionCheckService] Master com membership em conta ativa');
        return {
          success: true,
          hasActiveSubscription: true,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          userRole: 'master',
        };
      }

      return {
        success: true,
        hasActiveSubscription: false,
        userExists: true,
        matchSource,
        matchedIdentifier,
        userId: profile.supabaseId,
        subscription: hasSubscription
          ? {
              id: profile.subscriptionId,
              status: profile.subscriptionStatus,
            }
          : undefined,
      };
    }

    if (profile.managerId) {
      console.info('🔍 [SubscriptionCheckService] Usuário não é master, buscando assinatura do manager:', profile.managerId);

      const manager = await this.subscriptionRepository.findProfileById(profile.managerId);

      if (!manager) {
        console.error('❌ [SubscriptionCheckService] Manager não encontrado');
        return {
          success: true,
          hasActiveSubscription: false,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          userRole: profile.role,
        };
      }

      const hasSubscription = !!manager.subscriptionId;
      const isActive = manager.subscriptionStatus === 'active';
      const managerAccountBanned = manager.isMaster && (await isAccountMasterBanned(manager.id));

      if (!managerAccountBanned && hasSubscription && isActive) {
        console.info('✅ [SubscriptionCheckService] Manager do operador/manager tem assinatura ativa');
        return {
          success: true,
          hasActiveSubscription: true,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          userRole: profile.role,
          subscription: {
            id: manager.subscriptionId,
            status: manager.subscriptionStatus,
            startDate: manager.subscriptionStartDate,
            endDate: manager.subscriptionEndDate,
            plan: manager.subscriptionPlan,
            operatorCount: manager.operatorCount,
          },
        };
      }

      const message = hasSubscription && !isActive
        ? 'Manager com assinatura inativa'
        : 'Manager sem assinatura';

      console.warn(`⚠️ [SubscriptionCheckService] ${message}`);

      const hasGuestAccess = await this.hasActiveGuestMembership(profile.id);
      if (hasGuestAccess) {
        console.info('✅ [SubscriptionCheckService] Operador com membership em conta ativa');
        return {
          success: true,
          hasActiveSubscription: true,
          userExists: true,
          matchSource,
          matchedIdentifier,
          userId: profile.supabaseId,
          userRole: profile.role,
        };
      }

      return {
        success: true,
        hasActiveSubscription: false,
        userExists: true,
        matchSource,
        matchedIdentifier,
        userId: profile.supabaseId,
        userRole: profile.role,
        subscription: hasSubscription
          ? {
              id: manager.subscriptionId,
              status: manager.subscriptionStatus,
            }
          : undefined,
      };
    }

    const hasGuestAccess = await this.hasActiveGuestMembership(profile.id);
    if (hasGuestAccess) {
      console.info('✅ [SubscriptionCheckService] Usuário com membership em conta ativa');
      return {
        success: true,
        hasActiveSubscription: true,
        userExists: true,
        matchSource,
        matchedIdentifier,
        userId: profile.supabaseId,
        userRole: profile.role,
      };
    }

    console.warn('⚠️ [SubscriptionCheckService] Usuário sem manager definido e sem membership ativa');
    return {
      success: true,
      hasActiveSubscription: false,
      userExists: true,
      matchSource,
      matchedIdentifier,
      userId: profile.supabaseId,
      userRole: profile.role,
    };
  }
}
