// app/api/v1/subscriptions/[subscriptionId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { subscriptionStatusUseCase } from '@/app/api/useCases/subscriptions/SubscriptionStatusUseCase';

/**
 * GET /api/v1/subscriptions/[subscriptionId]/status
 * 
 * Verifica o status de pagamento de uma assinatura
 * Usado pelo polling do frontend para detectar quando o pagamento foi confirmado
 * 
 * @returns Output com informações de pagamento
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ subscriptionId: string }> }
) {
  try {
    // Aguardar params (Next.js 15)
    const { subscriptionId } = await params;

    console.info('🎯 [StatusController] GET /api/v1/subscriptions/[subscriptionId]/status');
    console.info('📋 [StatusController] subscriptionId:', subscriptionId);

    // Chamar UseCase
    const output = await subscriptionStatusUseCase.getSubscriptionStatus(subscriptionId);

    // Determinar status code baseado no resultado
    const statusCode = output.isValid ? 200 : 400;

    return NextResponse.json(output.result, { status: statusCode });

  } catch (error: any) {
    console.error('❌ [StatusController] Erro inesperado:', error);
    
    return NextResponse.json(
      {
        isPaid: false,
        status: 'error',
        message: error.message || 'Erro ao verificar status',
      },
      { status: 500 }
    );
  }
}
