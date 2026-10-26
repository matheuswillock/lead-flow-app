import { NextResponse, type NextRequest } from "next/server"
import { billingCheckoutIntentUseCase } from "@/app/api/useCases/billingCheckoutIntent/BillingCheckoutIntentUseCase"
import { PaymentMethodUnavailableError } from "@/lib/payment-methods/availability"
import { paymentMethodUnavailableOutput } from "@/lib/payment-methods/route-guard"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const output = await billingCheckoutIntentUseCase.getPublicDetails(token)
    return NextResponse.json(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Link inválido" }, { status: 400 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const body = await request.json().catch(() => null)
    const billingType = body && typeof body === "object" && "billingType" in body
      ? (body as { billingType?: unknown }).billingType
      : null
    const { token } = await params
    const output = await billingCheckoutIntentUseCase.createCheckout(token, String(billingType ?? ""))
    const result = output.result as { reused?: boolean } | null
    return NextResponse.json(output, { status: result?.reused ? 200 : 201 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    if (error instanceof PaymentMethodUnavailableError) {
      // Mantém `error` (contrato atual desta rota) e acrescenta o Output padrão.
      return NextResponse.json(
        { error: error.message, ...paymentMethodUnavailableOutput(error) },
        { status: error.status },
      )
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível criar o checkout" }, { status: 400 })
  }
}
