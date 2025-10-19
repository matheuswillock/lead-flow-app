// app/api/useCases/subscriptions/SubscriptionStatusUseCase.ts

import { Output } from "@/lib/output";
import { ISubscriptionStatusUseCase } from "./ISubscriptionStatusUseCase";
import { ISubscriptionStatusService } from "../../services/SubscriptionStatus/ISubscriptionStatusService";
import { SubscriptionStatusService } from "../../services/SubscriptionStatus/SubscriptionStatusService";

export class SubscriptionStatusUseCase implements ISubscriptionStatusUseCase {
  constructor(
    private subscriptionStatusService: ISubscriptionStatusService
  ) {}

  async getSubscriptionStatus(subscriptionId: string): Promise<Output> {
    try {
      console.info('📋 [SubscriptionStatusUseCase] Verificando status:', subscriptionId);

      // Validar entrada
      if (!subscriptionId) {
        return new Output(
          false,
          [],
          ['ID da assinatura é obrigatório'],
          null
        );
      }

      // Delegar para o Service
      const result = await this.subscriptionStatusService.checkPaymentStatus(subscriptionId);

      console.info('✅ [SubscriptionStatusUseCase] Status verificado:', {
        isPaid: result.isPaid,
        status: result.status,
      });

      return new Output(
        true,
        [result.message || 'Status verificado com sucesso'],
        [],
        result
      );

    } catch (error: any) {
      console.error('❌ [SubscriptionStatusUseCase] Erro:', error);
      
      return new Output(
        false,
        [],
        [error.message || 'Erro ao verificar status da assinatura'],
        null
      );
    }
  }
}

// Singleton com Service injetado
const subscriptionStatusService = new SubscriptionStatusService();
export const subscriptionStatusUseCase = new SubscriptionStatusUseCase(
  subscriptionStatusService
);
