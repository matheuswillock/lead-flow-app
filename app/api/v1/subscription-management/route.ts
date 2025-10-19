import { NextRequest, NextResponse } from 'next/server';
import { subscriptionManagementUseCase } from '@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supabaseId = searchParams.get('supabaseId');

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
    const { searchParams } = new URL(request.url);
    const supabaseId = searchParams.get('supabaseId');
    const reason = searchParams.get('reason') || undefined;

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
