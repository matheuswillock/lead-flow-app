import { NextRequest, NextResponse } from "next/server";
import { addOnCheckoutUseCase } from "@/app/api/useCases/addOnCheckout/AddOnCheckoutUseCase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ pendingActionId: string }> }
) {
  try {
    const { pendingActionId } = await params;

    const result = await addOnCheckoutUseCase.getCheckoutDetails(pendingActionId);

    return NextResponse.json(result, {
      status: result.isValid ? 200 : 404,
    });
  } catch (error: any) {
    console.error("[GET /api/v1/addon-checkout/[id]][GET]", error);
    return NextResponse.json(
      {
        isValid: false,
        successMessages: [],
        errorMessages: [error.message || "Erro ao buscar detalhes do checkout"],
        result: null,
      },
      { status: 500 }
    );
  }
}
