import { NextResponse } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { Output } from "@/lib/output"
import { publicFormMetricEventSchema } from "@/lib/public-forms/validation"
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
} from "@/lib/public-forms/rate-limit"
import { PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG } from "@/lib/queues/public-form-metric-events"
import { isPublicFormRequestOriginAllowed } from "@/lib/public-forms/request-origin-guard"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params
  if (!isPublicFormRequestOriginAllowed(request)) {
    return NextResponse.json(new Output(false, [], ["Origem não autorizada"], null), { status: 400 })
  }
  const parsed = publicFormMetricEventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(new Output(false, [], ["Evento inválido"], null), { status: 400 })
  }
  const rate = await consumePublicFormRateLimit(
    `event:${publicId}:${publicFormRequestFingerprint(request)}`,
    { limit: 120, windowMs: 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(new Output(false, [], ["Muitas requisições"], null), {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    })
  }

  const output = await publicFormsUseCase.recordMetric(publicId, parsed.data)
  if (output.isValid) {
    return NextResponse.json(output, { status: 202 })
  }

  const code =
    output.result && typeof output.result === "object" && "code" in output.result
      ? String((output.result as { code?: unknown }).code ?? "")
      : ""
  if (code === PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG) {
    console.error(
      `[PublicFormMetricEventsRoute][POST] ${PUBLIC_FORM_METRIC_QUEUE_PUBLISH_FAILED_TAG}`,
      { publicId, eventType: parsed.data.eventType, eventKey: parsed.data.eventKey },
    )
    return NextResponse.json(
      new Output(false, [], ["Não foi possível registrar o evento"], { retryable: true }),
      { status: 503, headers: { "Retry-After": "5" } },
    )
  }

  return NextResponse.json(output, { status: 404 })
}
