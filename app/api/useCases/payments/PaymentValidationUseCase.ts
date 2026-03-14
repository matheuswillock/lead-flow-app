// app/api/useCases/payments/PaymentValidationUseCase.ts

import { Output } from "@/lib/output";
import {
  IPaymentValidationUseCase,
  ValidatePaymentDTO,
  ProcessWebhookDTO,
} from './IPaymentValidationUseCase';
import {
  IPaymentValidationService,
  PaymentValidationResult,
} from '../../services/PaymentValidation/IPaymentValidationService';

export class PaymentValidationUseCase implements IPaymentValidationUseCase {
  constructor(private paymentValidationService: IPaymentValidationService) {}

  private createOutput(
    result: PaymentValidationResult,
    successMessage: string,
    errorMessage: string,
  ): Output {
    if (!result.success) {
      return new Output(false, [], [result.message || errorMessage], result);
    }

    return new Output(true, [result.message || successMessage], [], result);
  }

  async validatePayment(dto: ValidatePaymentDTO): Promise<Output> {
    console.info('[PaymentValidationUseCase] Validando pagamento...');

    if (!dto.paymentId) {
      return new Output(false, [], ['Payment ID é obrigatório'], null);
    }

    try {
      const result = await this.paymentValidationService.validatePayment(
        dto.paymentId
      );

      return this.createOutput(
        result,
        'Validação de pagamento concluída',
        'Erro ao validar pagamento',
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao validar pagamento';

      console.error('[PaymentValidationUseCase] Erro ao validar pagamento:', error);

      return new Output(false, [], [message], null);
    }
  }

  async processWebhook(dto: ProcessWebhookDTO): Promise<Output> {
    console.info(`[PaymentValidationUseCase] Processando webhook: ${dto.event}`);

    if (!dto.event || !dto.payment) {
      return new Output(false, [], ['Dados do webhook inválidos'], null);
    }

    try {
      const result = await this.paymentValidationService.processWebhook(
        dto.event,
        dto.payment
      );

      return this.createOutput(
        result,
        'Webhook processado com sucesso',
        'Erro ao processar webhook',
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Erro ao processar webhook';

      console.error('[PaymentValidationUseCase] Erro ao processar webhook:', error);

      return new Output(false, [], [message], null);
    }
  }
}
