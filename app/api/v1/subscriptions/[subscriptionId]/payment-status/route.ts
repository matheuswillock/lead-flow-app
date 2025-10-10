// app/api/v1/subscriptions/[subscriptionId]/payment-status/route.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/subscriptions/[subscriptionId]/payment-status
 * 
 * Endpoint SIMPLIFICADO que retorna status baseado apenas no webhook
 * NÃO faz chamadas externas - apenas verifica se o webhook já confirmou
 * 
 * @returns Status simples: confirmed ou pending
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    const { subscriptionId } = await params;

    console.info('✅ [PaymentStatusController] Verificação simples para:', subscriptionId);

    // Por enquanto, sempre retornar pending
    // O webhook vai atualizar e o frontend redirecionará manualmente
    return NextResponse.json({
      status: 'pending',
      message: 'Aguardando confirmação via webhook',
      subscriptionId
    });

  } catch (error: any) {
    console.error('❌ [PaymentStatusController] Erro:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        message: error.message || 'Erro ao verificar status',
      },
      { status: 500 }
    );
  }
}
