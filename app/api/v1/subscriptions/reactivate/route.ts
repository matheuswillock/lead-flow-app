import { NextRequest, NextResponse } from 'next/server';
import { subscriptionUpgradeUseCase } from '@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase';
import { Output } from '@/lib/output';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      supabaseId, 
      operatorCount, 
      paymentMethod,
      creditCard,
      creditCardHolderInfo,
      remoteIp 
    } = body;

    // Validações básicas
    if (!supabaseId) {
      const error = new Output(false, [], ['supabaseId é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    if (operatorCount === undefined || operatorCount === null) {
      const error = new Output(false, [], ['operatorCount é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    if (paymentMethod !== 'CREDIT_CARD' && paymentMethod !== 'PIX') {
      const error = new Output(false, [], ['Método de pagamento inválido. Use PIX ou CREDIT_CARD'], null);
      return NextResponse.json(error, { status: 400 });
    }

    if (paymentMethod === 'CREDIT_CARD' && (!creditCard || !creditCardHolderInfo)) {
      const error = new Output(false, [], ['Dados do cartão de crédito são obrigatórios para pagamento com cartão'], null);
      return NextResponse.json(error, { status: 400 });
    }

    // Chamar UseCase para reativar assinatura (cancelar antiga + criar nova)
    const result = await subscriptionUpgradeUseCase.reactivateSubscription({
      supabaseId,
      operatorCount,
      paymentMethod,
      creditCard,
      creditCardHolderInfo,
      remoteIp: remoteIp || '127.0.0.1'
    });

    const statusCode = result.isValid ? 201 : 400;
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro inesperado na route de reativação:', error);
    
    const errorResult = new Output(
      false,
      [],
      ['Erro inesperado no servidor'],
      null
    );

    return NextResponse.json(errorResult, { status: 500 });
  }
}
