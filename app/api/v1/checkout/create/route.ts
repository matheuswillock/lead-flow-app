import { NextRequest, NextResponse } from 'next/server';
import { checkoutAsaasUseCase } from '@/app/api/useCases/subscriptions/CheckoutAsaasUseCase';
import { Output } from '@/lib/output';

/**
 * POST /api/v1/checkout/create
 * Cria checkout Asaas para assinatura
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { supabaseId, fullName, email, phone, cpfCnpj } = body;

    console.info('📞 [POST /api/v1/checkout/create] Requisição recebida:', {
      supabaseId,
      email
    });

    // Validações
    if (!supabaseId) {
      const error = new Output(false, [], ['supabaseId é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    if (!fullName) {
      const error = new Output(false, [], ['fullName é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    if (!email) {
      const error = new Output(false, [], ['email é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    if (!phone) {
      const error = new Output(false, [], ['phone é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    if (!cpfCnpj) {
      const error = new Output(false, [], ['CPF/CNPJ é obrigatório'], null);
      return NextResponse.json(error, { status: 400 });
    }

    // Chamar UseCase
    const result = await checkoutAsaasUseCase.createSubscriptionCheckout({
      supabaseId,
      fullName,
      email,
      phone,
      cpfCnpj,
    });

    const statusCode = result.isValid ? 201 : 400;

    console.info(`📤 [POST /api/v1/checkout/create] Resposta: ${statusCode}`, {
      isValid: result.isValid,
      hasCheckoutUrl: !!result.result?.checkoutUrl
    });

    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('❌ [POST /api/v1/checkout/create] Erro inesperado:', error);

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
