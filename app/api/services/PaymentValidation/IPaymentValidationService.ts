// app/api/services/PaymentValidation/IPaymentValidationService.ts

import type { AsaasAccountId } from "@/lib/asaas";

export interface PaymentValidationResult {
  success: boolean;
  isPaid: boolean;
  paymentStatus?: string;
  profileUpdated?: boolean;
  message?: string;
}

export interface IPaymentValidationService {
  /**
   * Valida o status de um pagamento no Asaas
   * @param paymentId - ID do pagamento no Asaas
   * @returns Resultado da validação
   */
  validatePayment(paymentId: string): Promise<PaymentValidationResult>;

  /**
   * Processa um webhook de pagamento do Asaas
   * @param event - Tipo de evento (PAYMENT_RECEIVED, PAYMENT_CONFIRMED, etc)
   * @param paymentData - Dados do pagamento
   * @param account - Conta Asaas que originou o webhook. Grava junto do
   *   `asaasSubscriptionId` nos eventos de assinatura (achado P1 do PR
   *   #1207, thread PRRT_...YP_y) — sem ela um `sub_` legacy fica rotulado
   *   com o `primary` do default do schema.
   * @returns Resultado do processamento
   */
  processWebhook(
    event: string,
    paymentData: unknown,
    account: AsaasAccountId
  ): Promise<PaymentValidationResult>;
}
