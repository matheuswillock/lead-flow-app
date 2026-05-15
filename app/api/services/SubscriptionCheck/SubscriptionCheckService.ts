import { ISubscriptionRepository } from '../../infra/data/repositories/subscription/ISubscriptionRepository';
import { CheckSubscriptionResult, ISubscriptionCheckService } from './ISubscriptionCheckService';

export class SubscriptionCheckService implements ISubscriptionCheckService {
  constructor(private subscriptionRepository: ISubscriptionRepository) {}

  async checkActiveSubscription(email?: string, phone?: string, cpfCnpj?: string): Promise<CheckSubscriptionResult> {
    console.info('🔍 [SubscriptionCheckService] Verificando assinatura:', {
      email: email || 'não fornecido',
      phone: phone || 'não fornecido',
      cpfCnpj: cpfCnpj ? `${cpfCnpj?.substring(0,3)}***` : 'não fornecido',
    });

    // Buscar perfil do usuário
    const profile = await this.subscriptionRepository.findProfileByEmailOrPhone(email, phone, cpfCnpj);

    // Usuário não existe
    if (!profile) {
      console.info('✅ [SubscriptionCheckService] Usuário não encontrado');
      return {
        success: true,
        hasActiveSubscription: false,
        userExists: false,
      };
    }

    // Verificar se tem assinatura permanente (BYPASS ASAAS)
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

    // Determinar origem do match
    let matchSource: 'email' | 'phone' | 'document' | undefined;
    let matchedIdentifier: string | undefined;
    if (email && profile.email === email) {
      matchSource = 'email';
      matchedIdentifier = email;
    } else if (phone && profile.phone === phone) {
      matchSource = 'phone';
      matchedIdentifier = phone;
    } else if ((cpfCnpj as any) && (profile as any).cpfCnpj === cpfCnpj) {
      matchSource = 'document';
      matchedIdentifier = cpfCnpj;
    }

    // Se é MASTER, verifica sua própria assinatura
    if (profile.isMaster) {
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

      // Master sem assinatura ativa
      const message = hasSubscription && !isActive
        ? 'Master com assinatura inativa'
        : 'Master sem assinatura';
      
      console.warn(`⚠️ [SubscriptionCheckService] ${message}`);
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

    // Se NÃO é MASTER, busca a assinatura do seu manager
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

      if (hasSubscription && isActive) {
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

      // Manager sem assinatura ativa
      const message = hasSubscription && !isActive
        ? 'Manager com assinatura inativa'
        : 'Manager sem assinatura';
      
      console.warn(`⚠️ [SubscriptionCheckService] ${message}`);
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

    // Usuário sem manager e não é master (caso raro)
    console.warn('⚠️ [SubscriptionCheckService] Usuário sem manager definido e não é master');
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
