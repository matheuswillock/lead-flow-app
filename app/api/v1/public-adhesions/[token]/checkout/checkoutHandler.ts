import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import type { IBackofficeAdhesionUseCase } from "@/app/api/useCases/backofficeAdhesion/IBackofficeAdhesionUseCase"
import type { BillingRateLimitOptions, BillingRateLimitResult } from "@/lib/billing/billing-rate-limit"
import { hashBackofficeAdhesionToken } from "@/lib/backoffice-adhesions/adhesion-token-validation"
import { getTrustedClientIp } from "@/lib/http/get-trusted-client-ip"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const IP_RATE_LIMIT: BillingRateLimitOptions = { limit: 20, windowMs: 10 * 60_000 }
// Um token não pode gerar cobranças ilimitadas, de qualquer IP.
const TOKEN_RATE_LIMIT: BillingRateLimitOptions = { limit: 10, windowMs: 10 * 60_000 }
// IP não confiável (cabeçalho forjável) cai num balde compartilhado: falha fechada.
const UNTRUSTED_IP_BUCKET = "untrusted-shared"
const ABACATE_PIX_MESSAGE = "Use o pagamento por PIX da página de adesão."

type CheckoutBillingType = "PIX" | "CREDIT_CARD"

interface PublicAdhesionCreditCardPayload {
  holderName: string
  number: string
  expiryMonth: string
  expiryYear: string
  ccv: string
}

export type PublicAdhesionCheckoutDependencies = {
  useCase: Pick<IBackofficeAdhesionUseCase, "getPublicDetails" | "createCheckout">
  consumeRateLimit: (key: string, options: BillingRateLimitOptions) => Promise<BillingRateLimitResult>
  rejectUnavailableBillingType: (billingType: unknown) => Promise<NextResponse | null> | NextResponse | null
}

function getRemoteIp(request: NextRequest): string | undefined {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")?.trim()
  return forwardedFor || realIp || undefined
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function readBillingType(value: unknown): CheckoutBillingType | null {
  return value === "PIX" || value === "CREDIT_CARD" ? value : null
}

async function consumeBuckets(
  dependencies: PublicAdhesionCheckoutDependencies,
  request: NextRequest,
  token: string,
): Promise<BillingRateLimitResult> {
  const clientIp = getTrustedClientIp(request.headers) ?? UNTRUSTED_IP_BUCKET
  const ipLimit = await dependencies.consumeRateLimit(`public-adhesion-checkout:${clientIp}`, IP_RATE_LIMIT)
  if (!ipLimit.allowed) return ipLimit
  return dependencies.consumeRateLimit(
    `public-adhesion-checkout-token:${hashBackofficeAdhesionToken(token)}`,
    TOKEN_RATE_LIMIT,
  )
}

/** Adesão sem parcela Asaas pendente tem o PIX no Abacate: este checkout legado não pode cobrá-la. */
async function followsAbacatePix(
  useCase: PublicAdhesionCheckoutDependencies["useCase"],
  token: string,
): Promise<boolean> {
  const details = await useCase.getPublicDetails(token)
  return details.isValid && (details.result as { pixProvider?: string } | null)?.pixProvider === "ABACATE_PAY"
}

function buildCheckoutInput(data: Record<string, unknown>, billingType: CheckoutBillingType, remoteIp?: string) {
  const creditCard =
    data.creditCard && typeof data.creditCard === "object"
      ? (data.creditCard as PublicAdhesionCreditCardPayload)
      : undefined

  return {
    fullName: readString(data.fullName),
    email: readString(data.email),
    phone: readString(data.phone),
    cpfCnpj: readString(data.cpfCnpj),
    postalCode: readString(data.postalCode),
    address: readString(data.address),
    addressNumber: readString(data.addressNumber),
    neighborhood: readString(data.neighborhood),
    complement:
      typeof data.complement === "string" || data.complement === null ? data.complement : undefined,
    city: readString(data.city),
    state: readString(data.state),
    billingType,
    installments:
      typeof data.installments === "number" && Number.isFinite(data.installments)
        ? Math.trunc(data.installments)
        : undefined,
    creditCard,
    remoteIp,
  }
}

export function createPublicAdhesionCheckoutHandler(dependencies: PublicAdhesionCheckoutDependencies) {
  return async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
  ): Promise<NextResponse> {
    try {
      const { token } = await params
      const limit = await consumeBuckets(dependencies, request, token)
      if (!limit.allowed) {
        return NextResponse.json(
          new Output(false, [], ["Muitas tentativas. Aguarde alguns minutos e tente novamente."], null),
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
        )
      }

      const body = await request.json().catch(() => null)
      if (!body || typeof body !== "object") {
        return NextResponse.json(new Output(false, [], ["Payload inválido"], null), { status: 400 })
      }

      const data = body as Record<string, unknown>
      const billingType = readBillingType(data.billingType)
      if (!billingType) {
        return NextResponse.json(
          new Output(false, [], ["Forma de pagamento inválida. Use PIX ou CREDIT_CARD."], null),
          { status: 400 },
        )
      }

      if (billingType === "CREDIT_CARD") {
        const blocked = await dependencies.rejectUnavailableBillingType(billingType)
        if (blocked) return blocked
      } else if (await followsAbacatePix(dependencies.useCase, token)) {
        return NextResponse.json(new Output(false, [], [ABACATE_PIX_MESSAGE], null), { status: 409 })
      }

      const output = await dependencies.useCase.createCheckout(
        token,
        buildCheckoutInput(data, billingType, getRemoteIp(request)),
      )
      return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
    } catch (error) {
      rethrowIfPrerenderInterrupted(error)
      console.error("[PublicAdhesionCheckoutRoute][POST]", error)
      return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
    }
  }
}
