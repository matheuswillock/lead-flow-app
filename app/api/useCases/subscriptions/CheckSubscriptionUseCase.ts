import { ISubscriptionCheckService } from '../../services/SubscriptionCheck/ISubscriptionCheckService';
import { CheckSubscriptionDTO, ICheckSubscriptionUseCase } from './ICheckSubscriptionUseCase';
import { CheckSubscriptionResult } from '../../services/SubscriptionCheck/ISubscriptionCheckService';

export class CheckSubscriptionUseCase implements ICheckSubscriptionUseCase {
  constructor(private subscriptionCheckService: ISubscriptionCheckService) {}

  async execute(data: CheckSubscriptionDTO): Promise<CheckSubscriptionResult> {
    const { email, phone, cpfCnpj } = data;

    // Validação básica
    if (!email && !phone && !cpfCnpj) {
      throw new Error('Pelo menos um campo de identificação é necessário (email, phone ou cpfCnpj)');
    }

    console.info('📋 [CheckSubscriptionUseCase] Iniciando verificação de assinatura');

    try {
  const result = await this.subscriptionCheckService.checkActiveSubscription(email, phone, cpfCnpj);
      
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
