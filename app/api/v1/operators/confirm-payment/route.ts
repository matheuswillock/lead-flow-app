import { NextRequest, NextResponse } from "next/server";
import { subscriptionUpgradeUseCase } from "@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase";

/**
 * POST /api/v1/operators/confirm-payment
 * Confirma o pagamento e cria o operador (usado pelo webhook ou manualmente)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        {
          isValid: false,
          successMessages: [],
          errorMessages: ["ID do pagamento é obrigatório"],
          result: null,
        },
        { status: 400 }
      );
    }

    // Confirmar pagamento e criar operador
    const result = await subscriptionUpgradeUseCase.confirmPaymentAndCreateOperator(paymentId);

    const statusCode = result.isValid ? 201 : 400;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error);

    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: ["Erro interno do servidor"],
        result: null,
      },
      { status: 500 }
    );
  }
}
