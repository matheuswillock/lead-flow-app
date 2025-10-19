// app/api/services/SubscriptionStatus/ISubscriptionStatusService.ts

export interface SubscriptionStatusResult {
  isPaid: boolean;
  status: string;
  message: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  subscriptionStartDate?: Date | null;
  subscriptionEndDate?: Date | null;
  paymentId?: string;
  paymentStatus?: string;
  payments?: Array<{
    id: string;
    status: string;
    value: number;
  }>;
}

export interface ISubscriptionStatusService {
  /**
   * Verifica o status de pagamento de uma assinatura
   * Primeiro consulta o banco de dados (profile)
   * Se não encontrar, consulta diretamente no Asaas
   * 
   * @param subscriptionId ID da assinatura no Asaas
   * @returns Resultado com informações de pagamento
   */
  checkPaymentStatus(subscriptionId: string): Promise<SubscriptionStatusResult>;
}
