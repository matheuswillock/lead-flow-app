import { ISubscriptionRepository } from '../../infra/data/repositories/subscription/ISubscriptionRepository';
import { CheckSubscriptionResult, ISubscriptionCheckService } from './ISubscriptionCheckService';

export class SubscriptionCheckService implements ISubscriptionCheckService {
  constructor(private subscriptionRepository: ISubscriptionRepository) {}

  async checkActiveSubscription(email?: string, phone?: string): Promise<CheckSubscriptionResult> {
    console.info('🔍 [SubscriptionCheckService] Verificando assinatura:', {
      email: email || 'não fornecido',
      phone: phone || 'não fornecido',
    });

    // Buscar perfil do usuário
    const profile = await this.subscriptionRepository.findProfileByEmailOrPhone(email, phone);

    // Usuário não existe
    if (!profile) {
      console.info('✅ [SubscriptionCheckService] Usuário não encontrado');
      return {
        success: true,
        hasActiveSubscription: false,
        userExists: false,
      };
    }

    // Verificar se tem assinatura ativa
    const hasSubscription = !!profile.subscriptionId;
    const isActive = profile.subscriptionStatus === 'active';

    if (hasSubscription && isActive) {
      console.warn('⚠️ [SubscriptionCheckService] Assinatura ativa encontrada');
      return {
        success: true,
        hasActiveSubscription: true,
        userExists: true,
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

    // Usuário existe mas sem assinatura ativa
    const message = hasSubscription && !isActive
      ? 'Usuário com assinatura inativa'
      : 'Usuário sem assinatura';
    
    console.info(`✅ [SubscriptionCheckService] ${message}`);

    return {
      success: true,
      hasActiveSubscription: false,
      userExists: true,
      userId: profile.supabaseId,
      subscription: hasSubscription
        ? {
            id: profile.subscriptionId,
            status: profile.subscriptionStatus,
          }
        : undefined,
    };
  }
}
