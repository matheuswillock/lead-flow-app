import type { Output } from "@/lib/output";
import type { AsaasAccountId } from "@/lib/asaas";
import type { AsaasPayment, AsaasSubscription } from '../../services/PaymentValidation/AsaasWebhookTypes';
// app/api/useCases/payments/IPaymentValidationUseCase.ts

export interface ValidatePaymentDTO {
  paymentId: string;
}

export interface ProcessWebhookDTO {
  event: string;
  payment: AsaasPayment | AsaasSubscription;
  /**
   * Conta Asaas que originou o webhook. Achado P1 da revisão do PR #1207
   * (thread PRRT_...YP_y): `processAsaasWebhookEvent` já resolve a conta,
   * mas ela era descartada neste boundary — e o `SUBSCRIPTION_CREATED`/
   * `SUBSCRIPTION_UPDATED` legado acabava gravando um `sub_` da conta
   * legacy rotulado com o `primary` do default do schema.
   */
  account: AsaasAccountId;
}

export interface IPaymentValidationUseCase {
  validatePayment(dto: ValidatePaymentDTO): Promise<Output>;
  processWebhook(dto: ProcessWebhookDTO): Promise<Output>;
}
