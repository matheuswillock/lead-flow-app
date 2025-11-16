import { NextRequest, NextResponse } from "next/server";
import { subscriptionUpgradeUseCase } from "@/app/api/useCases/subscriptions/SubscriptionUpgradeUseCase";

/**
 * GET /api/v1/operators/payment-status/[paymentId]
 * Verifica o status de um pagamento de operador
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const { paymentId } = params;

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

    // Verificar status do pagamento
    const result = await subscriptionUpgradeUseCase.checkOperatorPaymentStatus(paymentId);

    const statusCode = result.isValid ? 200 : 400;

    return NextResponse.json(result, { status: statusCode });
  } catch (error) {
    console.error("Erro ao verificar status do pagamento:", error);

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
