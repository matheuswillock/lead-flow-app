import { Output } from "@/lib/output";
import { ISubscriptionCheckService } from '../../services/SubscriptionCheck/ISubscriptionCheckService';
import { CheckSubscriptionDTO, ICheckSubscriptionUseCase } from './ICheckSubscriptionUseCase';

export class CheckSubscriptionUseCase implements ICheckSubscriptionUseCase {
  constructor(private subscriptionCheckService: ISubscriptionCheckService) {}

  async execute(data: CheckSubscriptionDTO): Promise<Output> {
    const { email, phone, cpfCnpj } = data;

    if (!email && !phone && !cpfCnpj) {
      return new Output(
        false,
        [],
        ['Pelo menos um campo de identificação é necessário (email, phone ou cpfCnpj)'],
        null,
      );
    }

    console.info('📋 [CheckSubscriptionUseCase] Iniciando verificação de assinatura');

    try {
      const result = await this.subscriptionCheckService.checkActiveSubscription(
        email,
        phone,
        cpfCnpj,
      );

      console.info('📋 [CheckSubscriptionUseCase] Verificação concluída:', {
        hasActiveSubscription: result.hasActiveSubscription,
        userExists: result.userExists,
      });

      return new Output(
        true,
        ['Verificação de assinatura concluída'],
        [],
        result,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erro ao verificar assinatura';

      console.error('❌ [CheckSubscriptionUseCase] Erro na verificação:', error);

      return new Output(false, [], [message], null);
    }
  }
}
