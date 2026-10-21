import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { getTrustedClientIp } from "@/lib/http/get-trusted-client-ip"
import { hashBackofficeAdhesionToken } from "@/lib/backoffice-adhesions/adhesion-token-validation"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const IP_RATE_LIMIT = { limit: 20, windowMs: 10 * 60_000 }
// Um token não pode gerar cobranças ilimitadas, de qualquer IP.
const TOKEN_RATE_LIMIT = { limit: 10, windowMs: 10 * 60_000 }
// IP não confiável (cabeçalho forjável) cai num balde compartilhado: falha fechada.
const UNTRUSTED_IP_BUCKET = "untrusted-shared"

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
    const { token } = await params
    const clientIp = getTrustedClientIp(request.headers) ?? UNTRUSTED_IP_BUCKET
    const ipLimit = await consumeBillingRateLimit(`public-adhesion-pix:${clientIp}`, IP_RATE_LIMIT)
    const tokenLimit = ipLimit.allowed
      ? await consumeBillingRateLimit(
          `public-adhesion-pix-token:${hashBackofficeAdhesionToken(token)}`,
          TOKEN_RATE_LIMIT
        )
      : ipLimit
    if (!tokenLimit.allowed) {
      return NextResponse.json(
        new Output(false, [], ["Muitas tentativas. Aguarde alguns minutos e tente novamente."], null),
        { status: 429, headers: { "Retry-After": String(tokenLimit.retryAfterSeconds) } }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
    }

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
