import { NextRequest, NextResponse } from 'next/server';
import { subscriptionManagementUseCase } from '@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase';
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(request: NextRequest) {
  try {
    const authenticatedSupabaseId = request.headers.get('x-supabase-user-id');
    if (!authenticatedSupabaseId) {
      const unauthorizedResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['Não autenticado'],
        result: null
      };
      return NextResponse.json(unauthorizedResult, { status: 401 });
    }

    const body = await request.json();
    const { supabaseId: supabaseIdParam, ...paymentData } = body;

    if (supabaseIdParam && supabaseIdParam !== authenticatedSupabaseId) {
      const forbiddenResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['Acesso negado para atualizar assinatura de outro usuário'],
        result: null
      };
      return NextResponse.json(forbiddenResult, { status: 403 });
    }

    const supabaseId = authenticatedSupabaseId;

    if (!supabaseId) {
      const errorResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['ID do usuário é obrigatório'],
        result: null
      };
      return NextResponse.json(errorResult, { status: 400 });
    }

    const result = await subscriptionManagementUseCase.updatePaymentMethod(
      supabaseId,
      paymentData
    );
    const statusCode = result.isValid ? 200 : 400;

    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error('Erro inesperado na route:', error);

    const errorResult = {
      isValid: false,
      successMessages: [],
      errorMessages: ['Erro inesperado no servidor'],
      result: null
    };

    return NextResponse.json(errorResult, { status: 500 });
  }
}
