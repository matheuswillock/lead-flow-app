import { NextRequest, NextResponse } from 'next/server';
import { subscriptionUpgradeUseCase } from '@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

/**
 * POST /api/v1/operators/[operatorId]/remove
 * Remove operador e atualiza assinatura do manager
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ operatorId: string }> }
) {
  try {
    const { operatorId } = await params;

    console.info('📞 [POST /api/v1/operators/:operatorId/remove] Requisição recebida:', {
      operatorId
    });

    // Validação básica
    if (!operatorId) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ['ID do operador é obrigatório'],
          result: null
        },
        { status: 400 }
      );
    }

    // Chamar UseCase
    const result = await subscriptionUpgradeUseCase.removeOperatorAndUpdateSubscription(operatorId);

    const statusCode = result.isValid ? 200 : 400;

    console.info(`📤 [POST /api/v1/operators/:operatorId/remove] Resposta: ${statusCode}`, {
      isValid: result.isValid,
      operatorId
    });

    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('❌ [POST /api/v1/operators/:operatorId/remove] Erro inesperado:', error);

    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ['Erro interno do servidor'],
        result: null
      },
      { status: 500 }
    );
  }
}
