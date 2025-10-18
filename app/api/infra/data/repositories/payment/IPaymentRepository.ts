// app/api/infra/data/repositories/payment/IPaymentRepository.ts

import { Profile } from '@prisma/client';

export interface IPaymentRepository {
  /**
   * Busca um Profile pelo ID da assinatura do Asaas
   * @param subscriptionId - ID da assinatura no Asaas
   * @returns Profile ou null se não encontrado
   */
  findBySubscriptionId(subscriptionId: string): Promise<Profile | null>;

  /**
   * Busca um Profile pelo ID do customer do Asaas
   * @param asaasCustomerId - ID do customer no Asaas
   * @returns Profile ou null se não encontrado
   */
  findByAsaasCustomerId(asaasCustomerId: string): Promise<Profile | null>;

  /**
   * Atualiza o status da assinatura de um Profile
   * @param profileId - ID do Profile
   * @param subscriptionStatus - Novo status da assinatura
   * @param subscriptionStartDate - Data de início da assinatura (opcional)
   * @returns Profile atualizado
   */
  updateSubscriptionStatus(
    profileId: string,
    subscriptionStatus: string,
    subscriptionStartDate?: Date
  ): Promise<Profile>;

  /**
   * Upsert subscription linkage and status fields on the Profile.
   */
  updateSubscriptionData(
    profileId: string,
    data: {
      asaasCustomerId?: string;
      subscriptionId?: string;
      subscriptionPlan?: string;
      subscriptionStatus?: string;
      subscriptionStartDate?: Date;
    }
  ): Promise<Profile>;
}
