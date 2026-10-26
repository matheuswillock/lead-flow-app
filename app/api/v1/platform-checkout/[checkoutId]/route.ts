import { NextResponse, type NextRequest } from "next/server"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { handleGetPlatformCheckout } from "../platformCheckoutHandlers"
import { buildPlatformCheckoutHandlerDeps } from "../platformCheckoutHandlerDeps"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ checkoutId: string }> }
) {
  try {
    const { checkoutId } = await context.params
    return await handleGetPlatformCheckout(request, checkoutId, buildPlatformCheckoutHandlerDeps())
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PlatformCheckoutByIdRoute][GET]", error)
    return NextResponse.json(
      { isValid: false, errorMessages: ["Erro ao carregar checkout"] },
      { status: 500 }
    )
  }
}
