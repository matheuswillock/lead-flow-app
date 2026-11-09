import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { backofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/BackofficeAdhesionUseCase"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { getTrustedClientIp } from "@/lib/http/get-trusted-client-ip"
import { hashBackofficeAdhesionToken } from "@/lib/backoffice-adhesions/adhesion-token-validation"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const IP_RATE_LIMIT = { limit: 20, windowMs: 10 * 60_000 }
// Um token não pode gerar cobranças ilimitadas no cartão, de qualquer IP.
const TOKEN_RATE_LIMIT = { limit: 6, windowMs: 10 * 60_000 }
// IP não confiável (cabeçalho forjável) cai num balde compartilhado: falha fechada.
const UNTRUSTED_IP_BUCKET = "untrusted-shared"

function readString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

/**
 * Cartão da adesão cobrado pelo Abacate (cartão transparente). O token da URL é o escopo: o corpo
 * nunca escolhe adesão nem valor, e carrega só o token de uso único do cartão (`ctok_`), nunca o cartão.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const clientIp = getTrustedClientIp(request.headers) ?? UNTRUSTED_IP_BUCKET
    const ipLimit = await consumeBillingRateLimit(`public-adhesion-card:${clientIp}`, IP_RATE_LIMIT)
    const tokenLimit = ipLimit.allowed
      ? await consumeBillingRateLimit(
          `public-adhesion-card-token:${hashBackofficeAdhesionToken(token)}`,
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
    const payer = (data.payer && typeof data.payer === "object" ? data.payer : {}) as Record<string, unknown>
    const cardToken = readString(data.cardToken)
    if (!cardToken.startsWith("ctok_")) {
      return NextResponse.json(new Output(false, [], ["Token de cartão inválido"], null), { status: 400 })
    }

    const output = await backofficeAdhesionUseCase.createCardCheckout(
      token,
      {
        cardToken,
        installments: typeof data.installments === "number" ? data.installments : Number.NaN,
        payer: {
          fullName: readString(payer.fullName),
          email: readString(payer.email),
          phone: readString(payer.phone),
          cpfCnpj: readString(payer.cpfCnpj),
        },
      },
      readString(data.idempotencyKey)
    )

    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PublicAdhesionCardRoute][POST]", error instanceof Error ? error.name : "erro")
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
