import { NextResponse, type NextRequest } from "next/server"
import { getBackofficeAccess, type BackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import type { ProviderConfigActor } from "@/app/api/useCases/paymentProviderConfig/IPaymentProviderConfigUseCase"
import { consumeBillingRateLimit } from "@/lib/billing/billing-rate-limit"
import { Output } from "@/lib/output"
import { isSameOriginWrite } from "@/lib/security/write-origin-guard"
import type { PaymentProviderEnvironment, PaymentProviderKey } from "@/lib/payment-provider/types"

export function invalidRequest(message: string) {
  return NextResponse.json(new Output(false, [], [message], null), { status: 400 })
}

export function statusFor(output: Output, success = 200): number {
  if (output.isValid) return success
  const code = (output.result as { errorCode?: string } | null)?.errorCode
  if (code === "VALIDATION") return 400
  if (code === "NOT_FOUND") return 404
  if (code === "CONFLICT") return 409
  return 500
}

export function respond(output: Output, success = 200) {
  return NextResponse.json(output, { status: statusFor(output, success) })
}

/** Leitura: qualquer acesso ao backoffice. */
export async function authorizeRead(request: NextRequest) {
  const access = await getBackofficeAccess(request)
  if (access.error) return { response: NextResponse.json(access.error, { status: access.status }) }
  return { access: access.access }
}

type WriteGuardOptions = {
  /** Limite por minuto para operações com credencial. */
  readonly rateLimit?: { readonly scope: string; readonly limit: number }
}

/** Escrita: gerente (não operator), Origin same-origin e, opcionalmente, limite de taxa. */
export async function authorizeWrite(request: NextRequest, options: WriteGuardOptions = {}) {
  const access = await getBackofficeAccess(request)
  if (access.error) return { response: NextResponse.json(access.error, { status: access.status }) }
  const denied = requireManagerAccess(access.access)
  if (denied) return { response: denied }
  if (!isSameOriginWrite(request)) {
    return {
      response: NextResponse.json(new Output(false, [], ["Origem da requisição não permitida"], null), {
        status: 403,
      }),
    }
  }
  if (options.rateLimit) {
    const limited = await checkRateLimit(access.access, options.rateLimit)
    if (limited) return { response: limited }
  }
  return { access: access.access }
}

async function checkRateLimit(access: BackofficeAccess, rateLimit: { scope: string; limit: number }) {
  const result = await consumeBillingRateLimit(
    `payment-provider-${rateLimit.scope}:${access.backofficeUserId ?? access.profileId}`,
    { limit: rateLimit.limit, windowMs: 60_000 },
  )
  if (result.allowed) return null
  return NextResponse.json(new Output(false, [], ["Muitas tentativas. Aguarde um instante."], null), {
    status: 429,
    headers: { "Retry-After": String(result.retryAfterSeconds) },
  })
}

export function toActor(access: BackofficeAccess): ProviderConfigActor {
  return {
    profileId: access.profileId,
    backofficeUserId: access.backofficeUserId,
    backofficeEmail: access.backofficeEmail,
  }
}

export function parseEnvironment(value: unknown): PaymentProviderEnvironment | null {
  return value === "DEV" || value === "PRODUCTION" ? value : null
}

export function parseProvider(value: unknown): PaymentProviderKey | null {
  return value === "ASAAS" || value === "ABACATE_PAY" ? value : null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  )
}
