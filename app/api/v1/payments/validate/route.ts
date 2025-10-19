// app/api/v1/payments/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PaymentRepository } from '@/app/api/infra/data/repositories/payment/PaymentRepository';
import { PaymentValidationService } from '@/app/api/services/PaymentValidation/PaymentValidationService';
import { PaymentValidationUseCase } from '@/app/api/useCases/payments/PaymentValidationUseCase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.info('[POST /api/v1/payments/validate] Requisição recebida:', {
      paymentId: body.paymentId,
    });

    // Dependency Injection
    const paymentRepository = new PaymentRepository();
    const paymentValidationService = new PaymentValidationService(
      paymentRepository
    );
    const paymentValidationUseCase = new PaymentValidationUseCase(
      paymentValidationService
    );

    // Execute use case
    const result = await paymentValidationUseCase.validatePayment({
      paymentId: body.paymentId,
    });

    console.info('[POST /api/v1/payments/validate] Resultado:', result);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('[POST /api/v1/payments/validate] Erro:', error);
    return NextResponse.json(
      {
        success: false,
        isPaid: false,
        message: error.message || 'Erro ao validar pagamento',
      },
      { status: 400 }
    );
  }
}
