import { ISubscriptionCheckService } from '../../services/SubscriptionCheck/ISubscriptionCheckService';
import { CheckSubscriptionDTO, ICheckSubscriptionUseCase } from './ICheckSubscriptionUseCase';
import { CheckSubscriptionResult } from '../../services/SubscriptionCheck/ISubscriptionCheckService';

export class CheckSubscriptionUseCase implements ICheckSubscriptionUseCase {
  constructor(private subscriptionCheckService: ISubscriptionCheckService) {}

  async execute(data: CheckSubscriptionDTO): Promise<CheckSubscriptionResult> {
    const { email, phone } = data;

    // Validação básica
    if (!email && !phone) {
      throw new Error('Pelo menos um campo de identificação é necessário (email ou phone)');
    }

    console.info('📋 [CheckSubscriptionUseCase] Iniciando verificação de assinatura');

    try {
      const result = await this.subscriptionCheckService.checkActiveSubscription(email, phone);
      
      console.info('📋 [CheckSubscriptionUseCase] Verificação concluída:', {
        hasActiveSubscription: result.hasActiveSubscription,
        userExists: result.userExists,
      });

      return result;
    } catch (error: any) {
      console.error('❌ [CheckSubscriptionUseCase] Erro na verificação:', error.message);
      throw error;
    }
  }
}
