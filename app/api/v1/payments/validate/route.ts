// app/api/v1/payments/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PaymentRepository } from '@/app/api/infra/data/repositories/payment/PaymentRepository';
import { PaymentValidationService } from '@/app/api/services/PaymentValidation/PaymentValidationService';
import { PaymentValidationUseCase } from '@/app/api/useCases/payments/PaymentValidationUseCase';
import { Output } from '@/lib/output';

export async function POST(request: NextRequest) {
  const routeName = '[PaymentValidationRoute][POST]';

  try {
    const body = await request.json();

    console.info(`${routeName} Request received`, {
      hasPaymentId: !!body.paymentId,
    });

    const paymentRepository = new PaymentRepository();
    const paymentValidationService = new PaymentValidationService(
      paymentRepository
    );
    const paymentValidationUseCase = new PaymentValidationUseCase(
      paymentValidationService
    );

    const output = await paymentValidationUseCase.validatePayment({
      paymentId: body.paymentId,
    });

    const result = (output.result as { isPaid?: boolean; paymentStatus?: string } | null);
    const statusCode = output.isValid ? 200 : 400;

    console.info(`${routeName} Completed`, {
      isValid: output.isValid,
      isPaid: result?.isPaid ?? false,
      paymentStatus: result?.paymentStatus ?? null,
      errorMessages: output.errorMessages,
    });

    return NextResponse.json(output, { status: statusCode });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Erro ao validar pagamento';

    console.error(`${routeName} Unexpected error`, error);

    return NextResponse.json(
      new Output(false, [], [message], null),
      { status: 500 }
    );
  }
}
