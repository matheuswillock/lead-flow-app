// app/api/services/PaymentValidation/IPaymentValidationService.ts

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
   * @returns Resultado do processamento
   */
  processWebhook(
    event: string,
    paymentData: unknown
  ): Promise<PaymentValidationResult>;
}
