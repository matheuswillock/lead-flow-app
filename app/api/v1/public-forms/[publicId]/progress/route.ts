import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { publicFormProgressSchema } from "@/lib/public-forms/validation"
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
} from "@/lib/public-forms/rate-limit"
import { isPublicFormRequestOriginAllowed } from "@/lib/public-forms/request-origin-guard"
import { isE2eTestMode } from "@/lib/e2e/is-e2e-test-mode"
import { buildPublicFormProgressQueuePayload } from "@/lib/queues/public-form-progress-events"
import { queueProgressForBackgroundProcessing } from "@/lib/public-forms/queue-progress-for-background-processing"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params
  if (!isPublicFormRequestOriginAllowed(request)) {
    return NextResponse.json(new Output(false, [], ["Origem não autorizada"], null), { status: 400 })
  }
  const parsed = publicFormProgressSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(new Output(false, [], ["Progresso inválido"], null), { status: 400 })
  }
  const rate = await consumePublicFormRateLimit(
    `progress:${publicId}:${publicFormRequestFingerprint(request)}`,
    { limit: 120, windowMs: 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(new Output(false, [], ["Muitas requisições"], null), {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    })
  }

  console.info("[PublicFormProgressRoute][POST] recebido", {
    publicId,
    visitorSessionId: parsed.data.visitorSessionId,
    answerCount: parsed.data.answers.length,
    eventId: parsed.data.eventId ?? null,
    trigger: parsed.data.trigger ?? "blur",
  })

  if (parsed.data.answers.length > 0 && isE2eTestMode()) {
    const { publicFormProgressUseCase } = await import(
      "@/app/api/useCases/publicForms/PublicFormProgressUseCase"
    )
    const output = await publicFormProgressUseCase.execute(publicId, parsed.data)
    return NextResponse.json(output, { status: output.isValid ? 202 : 400 })
  }

  if (parsed.data.answers.length > 0) {
    const payload = buildPublicFormProgressQueuePayload({
      publicId,
      visitorSessionId: parsed.data.visitorSessionId,
      answers: parsed.data.answers,
      origin: parsed.data.origin ?? {},
      lastQuestionId: parsed.data.lastQuestionId,
      schemaVersion: parsed.data.schemaVersion,
      eventId: parsed.data.eventId,
      occurredAt: parsed.data.occurredAt,
      trigger: parsed.data.trigger,
    })
    const dispatch = await queueProgressForBackgroundProcessing(payload)
    if (!dispatch.accepted) {
      return NextResponse.json(
        new Output(false, [], ["Não foi possível registrar o progresso"], { retryable: true }),
        { status: 503, headers: { "Retry-After": "5" } },
      )
    }
  }

  return NextResponse.json(new Output(true, [], [], { queued: true }), { status: 202 })
}
