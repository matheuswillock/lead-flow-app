import { NextRequest, NextResponse } from 'next/server';
import { subscriptionManagementUseCase } from '@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase';

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const supabaseIdParam = searchParams.get('supabaseId');

    if (supabaseIdParam && supabaseIdParam !== authenticatedSupabaseId) {
      const forbiddenResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['Acesso negado para consultar assinatura de outro usuário'],
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

    const result = await subscriptionManagementUseCase.getSubscription(supabaseId);
    const statusCode = result.isValid ? 200 : 404;

    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
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

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const supabaseIdParam = searchParams.get('supabaseId');
    const reason = searchParams.get('reason') || undefined;

    if (supabaseIdParam && supabaseIdParam !== authenticatedSupabaseId) {
      const forbiddenResult = {
        isValid: false,
        successMessages: [],
        errorMessages: ['Acesso negado para cancelar assinatura de outro usuário'],
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

    const result = await subscriptionManagementUseCase.cancelSubscription(supabaseId, reason);
    const statusCode = result.isValid ? 200 : 400;

    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
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
