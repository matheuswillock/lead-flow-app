import { createHmac } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { consumePublicFormRateLimit } from "@/lib/public-forms/rate-limit"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { getTrustedClientIp } from "@/lib/http/get-trusted-client-ip"
import type { PasswordResetTelemetryEvent } from "@/lib/auth/password-reset-audit"
import { passwordResetTelemetryUseCase } from "@/app/api/useCases/passwordResetAudit/PasswordResetTelemetryUseCase"

const TELEMETRY_EVENTS = new Set<PasswordResetTelemetryEvent>([
  "page_opened",
  "verification_started",
  "token_verified",
  "token_rejected",
  "password_updated",
  "password_update_failed",
])

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

const TELEMETRY_RATE_LIMIT = { limit: 20, windowMs: 60_000 }
// Teto compartilhado quando não há IP confiável: impede que UUIDs aleatórios criem um
// balde por flowId e transformem a rota em consultas ilimitadas ao banco.
const UNATTRIBUTED_RATE_LIMIT = { limit: 300, windowMs: 60_000 }

async function consumeTelemetryRateLimit(flowId: string, clientIp: string | null) {
  const secret = process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET?.trim()
  if (clientIp && secret) {
    const ipKey = createHmac("sha256", secret).update(clientIp).digest("hex")
    return consumePublicFormRateLimit(`password-reset-telemetry:ip:${ipKey}`, TELEMETRY_RATE_LIMIT)
  }

  const perFlow = await consumePublicFormRateLimit(`password-reset-telemetry:flow:${flowId}`, TELEMETRY_RATE_LIMIT)
  if (!perFlow.allowed) return perFlow
  return consumePublicFormRateLimit("password-reset-telemetry:unattributed", UNATTRIBUTED_RATE_LIMIT)
}

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization")
  return header?.startsWith("Bearer ") ? header.slice(7).trim() || null : null
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !isUuid((body as { flowId?: unknown }).flowId) ||
      !TELEMETRY_EVENTS.has(
        (body as { eventType?: unknown }).eventType as PasswordResetTelemetryEvent,
      ) ||
      Object.keys(body).some((key) => !["flowId", "eventType"].includes(key))
    ) {
      return NextResponse.json(new Output(false, [], ["Payload de telemetria inválido"], null), {
        status: 400,
      })
    }

    const telemetry = body as { flowId: string; eventType: PasswordResetTelemetryEvent }
    // Só IP vindo de cabeçalho confiável (x-vercel-forwarded-for na Vercel): o
    // x-forwarded-for do cliente é forjável e burlaria o limite e a auditoria.
    const clientIp = getTrustedClientIp(request.headers)
    const rateLimit = await consumeTelemetryRateLimit(telemetry.flowId, clientIp)
    if (!rateLimit.allowed) {
      return NextResponse.json(new Output(false, [], ["Limite de telemetria excedido"], null), {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      })
    }

    const output = await passwordResetTelemetryUseCase.execute({
      flowId: telemetry.flowId,
      eventType: telemetry.eventType,
      accessToken: getBearerToken(request),
      ip: clientIp,
      userAgent: request.headers.get("user-agent"),
    })
    const forbidden = (output.result as { outcome?: string } | null)?.outcome === "forbidden"
    return NextResponse.json(output, { status: output.isValid ? 200 : forbidden ? 403 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PasswordResetTelemetryRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
