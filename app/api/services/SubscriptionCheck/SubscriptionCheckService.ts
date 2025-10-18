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

    // Verificar se tem assinatura ativa
    const hasSubscription = !!profile.subscriptionId;
    const isActive = profile.subscriptionStatus === 'active';

    if (hasSubscription && isActive) {
      console.warn('⚠️ [SubscriptionCheckService] Assinatura ativa encontrada');
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

    // Usuário existe mas sem assinatura ativa
    const message = hasSubscription && !isActive
      ? 'Usuário com assinatura inativa'
      : 'Usuário sem assinatura';
    
    console.info(`✅ [SubscriptionCheckService] ${message}`);

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
}
