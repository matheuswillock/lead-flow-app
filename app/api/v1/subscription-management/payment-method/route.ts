import { NextRequest, NextResponse } from 'next/server';
import { subscriptionManagementUseCase } from '@/app/api/useCases/subscriptionManagement/SubscriptionManagementUseCase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supabaseId, ...paymentData } = body;

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
