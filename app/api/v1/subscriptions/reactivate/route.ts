import { NextRequest, NextResponse } from 'next/server';
import { subscriptionUpgradeUseCase } from '@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase';
import { Output } from '@/lib/output';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { rejectUnavailableBillingType } from '@/lib/payment-methods/route-guard';
import { requireActiveAccountAccess } from "@/app/api/v1/utils/requireActiveAccountAccess";

export async function POST(request: NextRequest) {
  try {
    const authenticatedSupabaseId = request.headers.get("x-supabase-user-id");
    if (!authenticatedSupabaseId) {
      return NextResponse.json(new Output(false, [], ["Não autenticado"], null), { status: 401 });
    }

    const accessDeniedResponse = await requireActiveAccountAccess(authenticatedSupabaseId);
    if (accessDeniedResponse) {
      return accessDeniedResponse;
    }

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
    if (supabaseId && supabaseId !== authenticatedSupabaseId) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado para reativar a assinatura de outro usuário"], null),
        { status: 403 }
      );
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

    // Reativação exige o formulário do cartão (nova escolha de cartão), então não há isenção de assinante.
    const unavailableMethod = rejectUnavailableBillingType(paymentMethod);
    if (unavailableMethod) return unavailableMethod;

    // Chamar UseCase para reativar assinatura (cancelar antiga + criar nova)
    const result = await subscriptionUpgradeUseCase.reactivateSubscription({
      supabaseId: authenticatedSupabaseId,
      operatorCount,
      paymentMethod,
      creditCard,
      creditCardHolderInfo,
      remoteIp: remoteIp || '127.0.0.1'
    });

    const statusCode = result.isValid ? 201 : 400;
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
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
