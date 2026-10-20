import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServer } from "@/lib/supabase/server"
import { consumePublicFormRateLimit } from "@/lib/public-forms/rate-limit"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import {
  passwordResetAuditService,
  type PasswordResetTelemetryEvent,
} from "@/app/api/services/passwordResetAudit/PasswordResetAuditService"

const TELEMETRY_EVENTS = new Set<PasswordResetTelemetryEvent>([
  "token_verified",
  "token_rejected",
  "password_updated",
  "expired",
])

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const user = supabase ? (await supabase.auth.getUser()).data.user : null
    if (!user) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const rateLimit = await consumePublicFormRateLimit(`password-reset-telemetry:${user.id}`, {
      limit: 20,
      windowMs: 60_000,
    })
    if (!rateLimit.allowed) {
      return NextResponse.json(new Output(false, [], ["Limite de telemetria excedido"], null), {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      })
    }

    const body: unknown = await request.json()
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      !isUuid((body as { flowId?: unknown }).flowId) ||
      !TELEMETRY_EVENTS.has((body as { event?: unknown }).event as PasswordResetTelemetryEvent) ||
      Object.keys(body).some((key) => !["flowId", "event"].includes(key))
    ) {
      return NextResponse.json(new Output(false, [], ["Payload de telemetria inválido"], null), { status: 400 })
    }

    const telemetry = body as { flowId: string; event: PasswordResetTelemetryEvent }
    const recorded = await passwordResetAuditService.recordTelemetry({
      flowId: telemetry.flowId,
      supabaseId: user.id,
      event: telemetry.event,
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
