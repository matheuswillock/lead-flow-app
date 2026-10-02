// app/api/infra/data/repositories/payment/IPaymentRepository.ts

import { Profile } from '@prisma/client';
import type { AsaasAccountId } from '@/lib/asaas';

export interface IPaymentRepository {
  /**
   * Busca um Profile pelo ID da assinatura do Asaas
   * @param subscriptionId - ID da assinatura no Asaas
   * @returns Profile ou null se não encontrado
   */
  findBySubscriptionId(subscriptionId: string, account?: AsaasAccountId): Promise<Profile | null>;

  /**
   * Busca um Profile pelo ID do customer do Asaas
   * @param asaasCustomerId - ID do customer no Asaas
   * @returns Profile ou null se não encontrado
   */
  findByAsaasCustomerId(asaasCustomerId: string, account?: AsaasAccountId): Promise<Profile | null>;

  /**
   * Busca um Profile pelo email
   */
  findByEmail(email: string): Promise<Profile | null>;

  /**
   * Busca um Profile pelo ID (UUID)
   */
  findById(id: string): Promise<Profile | null>;

  /**
   * Atualiza o status da assinatura de um Profile
   * @param profileId - ID do Profile
   * @param subscriptionStatus - Novo status da assinatura
   * @param subscriptionStartDate - Data de início da assinatura
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
      /**
       * Conta Asaas dona do `subscriptionId` acima. Achado P1 da revisão do
       * PR #1207 (thread PRRT_...YP_y): sem ela o upsert de
       * ProfileSubscription cai no `@default(primary)` do schema mesmo
       * quando o webhook veio da conta legacy, e a reconciliação de 30-E7
       * passa a procurar o `sub_` na conta errada. Informe sempre que
       * `subscriptionId` for informado; omita nos updates que só mexem em
       * status (PAYMENT_OVERDUE, refund), que não tocam o ponteiro.
       */
      subscriptionAccount?: AsaasAccountId;
      subscriptionPlan?: string;
      subscriptionStatus?: string;
      subscriptionStartDate?: Date;
      subscriptionEndDate?: Date;
    }
  ): Promise<Profile>;
}
