import { NextResponse, type NextRequest } from "next/server"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { handleCreatePlatformCheckout } from "./platformCheckoutHandlers"
import { buildPlatformCheckoutHandlerDeps } from "./platformCheckoutHandlerDeps"

export async function POST(request: NextRequest) {
  try {
    return await handleCreatePlatformCheckout(request, buildPlatformCheckoutHandlerDeps())
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PlatformCheckoutRoute][POST]", error)
    return NextResponse.json(
      { isValid: false, errorMessages: ["Erro ao criar checkout genérico"] },
      { status: 500 }
    )
  }
}
