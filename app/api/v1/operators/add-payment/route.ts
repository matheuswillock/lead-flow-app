import { NextRequest, NextResponse } from "next/server";
import { subscriptionUpgradeUseCase } from "@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase";

/**
 * POST /api/v1/operators/add-operator-payment
 * Cria pagamento para adicionar novo operador
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { managerId, operatorData, paymentMethod, creditCardData } = body;

    // Validações básicas
    if (!managerId || !operatorData || !paymentMethod) {
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

    // Criar pagamento
    const result = await subscriptionUpgradeUseCase.createOperatorPayment({
      managerId,
      operatorData,
      paymentMethod,
      creditCardData
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
