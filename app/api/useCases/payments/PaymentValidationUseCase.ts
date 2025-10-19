// app/api/useCases/payments/PaymentValidationUseCase.ts

import {
  IPaymentValidationUseCase,
  ValidatePaymentDTO,
  ProcessWebhookDTO,
} from './IPaymentValidationUseCase';
import { IPaymentValidationService } from '../../services/PaymentValidation/IPaymentValidationService';

export class PaymentValidationUseCase implements IPaymentValidationUseCase {
  constructor(private paymentValidationService: IPaymentValidationService) {}

  async validatePayment(dto: ValidatePaymentDTO): Promise<any> {
    console.info('[PaymentValidationUseCase] Validando pagamento...');

    if (!dto.paymentId) {
      throw new Error('Payment ID é obrigatório');
    }

    const result = await this.paymentValidationService.validatePayment(
      dto.paymentId
    );

    return result;
  }

  async processWebhook(dto: ProcessWebhookDTO): Promise<any> {
    console.info(`[PaymentValidationUseCase] Processando webhook: ${dto.event}`);

    if (!dto.event || !dto.payment) {
      throw new Error('Dados do webhook inválidos');
    }

    const result = await this.paymentValidationService.processWebhook(
      dto.event,
      dto.payment
    );

    return result;
  }
}
