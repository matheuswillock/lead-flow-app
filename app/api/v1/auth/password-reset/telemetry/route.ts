import { NextRequest, NextResponse } from "next/server"
import { consumePublicFormRateLimit, publicFormRequestFingerprint } from "@/lib/public-forms/rate-limit"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  passwordResetAuditService,
  type PasswordResetTelemetryEvent,
} from "@/app/api/services/passwordResetAudit/PasswordResetAuditService"

const TELEMETRY_EVENTS = new Set<PasswordResetTelemetryEvent>([
  "page_opened",
  "verification_started",
  "token_verified",
  "token_rejected",
  "password_updated",
  "password_update_failed",
  "expired",
])

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    const flowId = body && typeof body === "object" && !Array.isArray(body)
      ? (body as { flowId?: unknown }).flowId
      : undefined
    const eventType = body && typeof body === "object" && !Array.isArray(body)
      ? (body as { eventType?: unknown }).eventType
      : undefined

    if (
      !isUuid(flowId) ||
      typeof eventType !== "string" ||
      !TELEMETRY_EVENTS.has(eventType as PasswordResetTelemetryEvent) ||
      !Object.keys(body as object).every((key) => ["flowId", "eventType"].includes(key))
    ) {
      return NextResponse.json(new Output(false, [], ["Payload de telemetria inválido"], null), { status: 400 })
    }

    const fingerprint = publicFormRequestFingerprint(request)
    const rateLimit = await consumePublicFormRateLimit(`password-reset-telemetry:${fingerprint}`, {
      limit: 30,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(new Output(false, [], ["Limite de telemetria excedido"], null), {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      })
    }

    const recorded = await passwordResetAuditService.recordTelemetry({
      flowId,
      event: eventType as PasswordResetTelemetryEvent,
      ip: fingerprint,
      userAgent: request.headers.get("user-agent"),
    })
    if (!recorded) {
      return NextResponse.json(new Output(false, [], ["Fluxo de reset não encontrado"], null), { status: 404 })
    }

    return NextResponse.json(new Output(true, ["Telemetria registrada"], [], null), { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PasswordResetTelemetryRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
