import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import type { ISelfCheckoutUseCase } from "@/app/api/useCases/selfCheckout/ISelfCheckoutUseCase"
import { detectSqlInjection } from "@/app/api/v1/utils/inputSecurity"
import type { BillingRateLimitOptions, BillingRateLimitResult } from "@/lib/billing/billing-rate-limit"
import { getTrustedClientIp } from "@/lib/http/get-trusted-client-ip"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { isPublicFormRequestOriginAllowed } from "@/lib/public-forms/request-origin-guard"
import {
  SELF_CHECKOUT_ERROR_STATUS,
  selfCheckoutRequestSchema,
  type SelfCheckoutErrorCode,
  type SelfCheckoutRequest,
} from "@/lib/self-checkout/contracts"

const IP_RATE_LIMIT: BillingRateLimitOptions = { limit: 5, windowMs: 10 * 60_000 }
const EMAIL_RATE_LIMIT: BillingRateLimitOptions = { limit: 3, windowMs: 10 * 60_000 }
// IP não confiável (cabeçalho forjável) cai num balde compartilhado: falha fechada.
const UNTRUSTED_IP_BUCKET = "untrusted-shared"
// Respostas de erro de entrada nunca revelam qual guarda barrou o pedido.
const GENERIC_INVALID_MESSAGE = "Dados inválidos para submissão."
const RATE_LIMITED_MESSAGE = "Muitas tentativas. Aguarde alguns minutos e tente novamente."
const INTERNAL_ERROR_MESSAGE = "Erro interno"
const OPTIONS_CACHE_CONTROL = "public, max-age=0, s-maxage=15"

export type SelfCheckoutHandlerDependencies = {
  useCase: ISelfCheckoutUseCase
  consumeRateLimit: (key: string, options: BillingRateLimitOptions) => Promise<BillingRateLimitResult>
}

function failure(messages: string[], status: number, headers?: Record<string, string>) {
  return NextResponse.json(new Output(false, [], messages, null), { status, headers })
}

function hasSuspiciousText(input: SelfCheckoutRequest): boolean {
  return [input.fullName, input.email, input.phone].some((value) => detectSqlInjection(value).suspicious)
}

function hashEmail(email: string): string {
  return createHash("sha256").update(email).digest("hex")
}

async function consumeBuckets(
  dependencies: SelfCheckoutHandlerDependencies,
  request: Request,
  email: string,
): Promise<BillingRateLimitResult> {
  const clientIp = getTrustedClientIp(request.headers) ?? UNTRUSTED_IP_BUCKET
  const ipLimit = await dependencies.consumeRateLimit(`public-self-checkout-ip:${clientIp}`, IP_RATE_LIMIT)
  if (!ipLimit.allowed) return ipLimit
  return dependencies.consumeRateLimit(`public-self-checkout-email:${hashEmail(email)}`, EMAIL_RATE_LIMIT)
}

function isCode(value: unknown): value is SelfCheckoutErrorCode {
  return typeof value === "string" && value in SELF_CHECKOUT_ERROR_STATUS
}

function statusFor(output: Output): number {
  const code = (output.result as { code?: unknown } | null)?.code
  return isCode(code) ? SELF_CHECKOUT_ERROR_STATUS[code] : 500
}

/** Valida o corpo e as guardas de entrada; devolve a resposta de recusa ou os dados limpos. */
async function readGuardedInput(request: Request): Promise<Response | SelfCheckoutRequest> {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") return failure([GENERIC_INVALID_MESSAGE], 400)

  const parsed = selfCheckoutRequestSchema.safeParse(body)
  if (!parsed.success) return failure(parsed.error.issues.map((issue) => issue.message), 400)

  const { website, ...input } = parsed.data
  if (website) return failure([GENERIC_INVALID_MESSAGE], 400)
  if (hasSuspiciousText(input)) return failure([GENERIC_INVALID_MESSAGE], 400)
  if (!isPublicFormRequestOriginAllowed(request)) return failure([GENERIC_INVALID_MESSAGE], 400)
  return input
}

export function createSelfCheckoutPostHandler(dependencies: SelfCheckoutHandlerDependencies) {
  return async function POST(request: Request): Promise<Response> {
    try {
      const input = await readGuardedInput(request)
      if (input instanceof Response) return input

      const limit = await consumeBuckets(dependencies, request, input.email)
      if (!limit.allowed) {
        return failure([RATE_LIMITED_MESSAGE], 429, { "Retry-After": String(limit.retryAfterSeconds) })
      }

      const output = await dependencies.useCase.create(input)
      return NextResponse.json(output, { status: output.isValid ? 200 : statusFor(output) })
    } catch (error) {
      rethrowIfPrerenderInterrupted(error)
      console.error("[PublicSelfCheckoutRoute][POST]", error instanceof Error ? error.name : "erro")
      return failure([INTERNAL_ERROR_MESSAGE], 500)
    }
  }
}

export function createSelfCheckoutOptionsHandler(useCase: ISelfCheckoutUseCase) {
  return async function GET(): Promise<Response> {
    try {
      const output = await useCase.getOptions()
      if (!output.isValid) {
        return NextResponse.json(output, { status: 500, headers: { "Cache-Control": "no-store" } })
      }
      return NextResponse.json(output, { headers: { "Cache-Control": OPTIONS_CACHE_CONTROL } })
    } catch (error) {
      rethrowIfPrerenderInterrupted(error)
      console.error("[PublicSelfCheckoutOptionsRoute][GET]", error)
      return NextResponse.json(new Output(false, [], [INTERNAL_ERROR_MESSAGE], null), {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      })
    }
  }
}
