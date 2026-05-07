import { NextRequest, NextResponse } from "next/server";
import { addOnCheckoutUseCase } from "@/app/api/useCases/addOnCheckout/AddOnCheckoutUseCase";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pendingActionId: string }> }
) {
  try {
    const { pendingActionId } = await params;
    const body = await request.json().catch(() => ({}));

    const result = await addOnCheckoutUseCase.updateBillingType(
      pendingActionId,
      body?.billingType
    );

    return NextResponse.json(result, {
      status: result.isValid ? 200 : 400,
    });
  } catch (error: any) {
    console.error("[PATCH /api/v1/addon-checkout/[id]/billing-type][PATCH]", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: [error.message || "Erro ao atualizar meio de pagamento"],
        result: null,
      },
      { status: 500 }
    );
  }
}
