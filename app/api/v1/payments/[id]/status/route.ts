// app/api/v1/payments/[id]/status/route.ts
import { NextRequest, NextResponse, connection } from "next/server";
import { getPaymentByAccountWithFallback } from '@/lib/billing/get-payment-by-account';

/**
 * GET /api/v1/payments/[id]/status
 * Verifica o status de um pagamento
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connection();

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

    // Busca o status do pagamento no Asaas — roteado com fallback de conta
    // (C24 de [[20 — Assinaturas — Backend]] E5).
    const lookup = await getPaymentByAccountWithFallback(id);

    if (!lookup.found) {
      return NextResponse.json(
        { isValid: false, errorMessages: ['Pagamento não encontrado'], result: null },
        { status: 404 }
      );
    }

    const payment = lookup.payment as {
      id: string;
      status?: string;
      value?: number;
      netValue?: number;
      billingType?: string;
      confirmedDate?: string;
      paymentDate?: string;
      clientPaymentDate?: string;
    };

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
