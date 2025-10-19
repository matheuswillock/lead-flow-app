// app/api/v1/payments/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { asaasFetch, asaasApi } from '@/lib/asaas';

/**
 * GET /api/v1/payments/[id]/status
 * Verifica o status de um pagamento
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['ID do pagamento é obrigatório'],
          result: null,
        },
        { status: 400 }
      );
    }

    console.info('🔍 [PaymentStatus] Verificando status do pagamento:', id);

    // Busca o status do pagamento no Asaas
    const payment = await asaasFetch(`${asaasApi.payments}/${id}`);

    console.info('✅ [PaymentStatus] Status:', payment.status);

    return NextResponse.json({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        netValue: payment.netValue,
        billingType: payment.billingType,
        confirmedDate: payment.confirmedDate,
        paymentDate: payment.paymentDate,
        clientPaymentDate: payment.clientPaymentDate,
      },
    });
  } catch (error: any) {
    console.error('❌ [PaymentStatus] Erro ao verificar status:', error);

    return NextResponse.json(
      {
        isValid: false,
        errorMessages: [error.message || 'Erro ao verificar status do pagamento'],
        result: null,
      },
      { status: 500 }
    );
  }
}
