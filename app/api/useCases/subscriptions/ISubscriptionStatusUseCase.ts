// app/api/useCases/subscriptions/ISubscriptionStatusUseCase.ts

import { Output } from "@/lib/output";

export interface ISubscriptionStatusUseCase {
  /**
   * Verifica o status de pagamento de uma assinatura
   * @param subscriptionId ID da assinatura no Asaas
   * @returns Output com informações de pagamento
   */
  getSubscriptionStatus(subscriptionId: string): Promise<Output>;
}
