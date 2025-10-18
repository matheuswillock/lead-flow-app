import type { AsaasPayment, AsaasSubscription } from '../../services/PaymentValidation/AsaasWebhookTypes';
// app/api/useCases/payments/IPaymentValidationUseCase.ts

export interface ValidatePaymentDTO {
  paymentId: string;
}

export interface ProcessWebhookDTO {
  event: string;
  payment: AsaasPayment | AsaasSubscription;
}

export interface IPaymentValidationUseCase {
  validatePayment(dto: ValidatePaymentDTO): Promise<any>;
  processWebhook(dto: ProcessWebhookDTO): Promise<any>;
}
