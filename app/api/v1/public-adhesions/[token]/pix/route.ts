import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { getClientIpFromRequest } from "@/lib/http/get-client-ip"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const RATE_LIMIT = { limit: 20, windowMs: 10 * 60_000 }

function readString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/**
 * PIX da adesão cobrado pelo provider de pagamento. O token da URL é o escopo: o corpo nunca
 * escolhe adesão nem valor.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const rateLimit = await consumeBillingRateLimit(
      `public-adhesion-pix:${getClientIpFromRequest(request)}`,
      RATE_LIMIT
    )
    if (!rateLimit.allowed) {
      return NextResponse.json(
        new Output(false, [], ["Muitas tentativas. Aguarde alguns minutos e tente novamente."], null),
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

    const { token } = await params
    const data = body as Record<string, unknown>
    const output = await backofficeAdhesionUseCase.createPixCheckout(
      token,
      {
        fullName: readString(data.fullName),
        email: readString(data.email),
        phone: readString(data.phone),
        cpfCnpj: readString(data.cpfCnpj),
      },
      readString(data.idempotencyKey)
    )

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PublicAdhesionPixRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
