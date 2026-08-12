import { NextResponse } from "next/server"
import { platformCheckoutUseCase } from "@/app/api/useCases/platformCheckout/PlatformCheckoutUseCase"

export async function GET(
  _request: Request,
  context: { params: Promise<{ checkoutId: string }> }
) {
  try {
    const { checkoutId } = await context.params
    const output = await platformCheckoutUseCase.getCheckoutDetails(checkoutId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    console.error("[PlatformCheckoutByIdRoute][GET]", error)
    return NextResponse.json(
      { isValid: false, errorMessages: ["Erro ao carregar checkout"] },
      { status: 500 }
    )
  }
}
