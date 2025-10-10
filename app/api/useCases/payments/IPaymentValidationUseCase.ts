// app/api/useCases/payments/IPaymentValidationUseCase.ts

export interface ValidatePaymentDTO {
  paymentId: string;
}

export interface ProcessWebhookDTO {
  event: string;
  payment: any;
}

export interface IPaymentValidationUseCase {
  validatePayment(dto: ValidatePaymentDTO): Promise<any>;
  processWebhook(dto: ProcessWebhookDTO): Promise<any>;
}
