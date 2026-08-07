import { NextRequest, NextResponse, connection } from "next/server";
import { addOnCheckoutUseCase } from "@/app/api/useCases/addOnCheckout/AddOnCheckoutUseCase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pendingActionId: string }> }
) {
  await connection();

  try {
    const { pendingActionId } = await params;

    const result = await addOnCheckoutUseCase.checkPaymentStatus(pendingActionId);

    return NextResponse.json(result, {
      status: result.isValid ? 200 : 400,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/addon-checkout/[id]/status][GET]", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: [error.message || "Erro ao buscar status do pagamento"],
        result: null,
      },
      { status: 500 }
    );
  }
}
