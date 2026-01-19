import { NextRequest, NextResponse } from "next/server";
import { checkoutAsaasUseCase } from "@/app/api/useCases/subscriptions/CheckoutAsaasUseCase";

/**
 * POST /api/v1/operators/add-payment
 * Cria checkout hospedado do Asaas para adicionar novo operador
 * Incrementa assinatura existente do manager em +R$ 19,90
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { managerId, operatorData } = body;

    // Validações básicas
    if (!managerId || !operatorData) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ['Dados incompletos'],
          result: null
        },
        { status: 400 }
      );
    }

    if (!operatorData.name || !operatorData.email) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ['Nome e e-mail do operador são obrigatórios'],
          result: null
        },
        { status: 400 }
      );
    }

    // Criar checkout usando o mesmo fluxo de novos usuários
    const result = await checkoutAsaasUseCase.createOperatorCheckout({
      managerId,
      operatorData: {
        name: operatorData.name,
        email: operatorData.email,
        role: operatorData.role || 'operator',
      }
    });

    const statusCode = result.isValid ? 201 : 400;
    return NextResponse.json(result, { status: statusCode });

  } catch (error) {
    console.error('Erro na route de pagamento de operador:', error);
    
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
