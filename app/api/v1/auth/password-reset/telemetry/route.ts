import { createHmac } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { consumePublicFormRateLimit } from "@/lib/public-forms/rate-limit"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
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

function getRateLimitKey(request: NextRequest, flowId: string): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")
  const secret = process.env.PASSWORD_RESET_AUDIT_IP_HASH_SECRET?.trim()
  const ipKey = ip && secret ? createHmac("sha256", secret).update(ip).digest("hex") : null
  return `password-reset-telemetry:${ipKey ?? flowId}`
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
    const rateLimit = await consumePublicFormRateLimit(getRateLimitKey(request, telemetry.flowId), {
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(new Output(false, [], ["Limite de telemetria excedido"], null), {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      })
    }

    const output = await passwordResetTelemetryUseCase.execute({
      flowId: telemetry.flowId,
      eventType: telemetry.eventType,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PasswordResetTelemetryRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
