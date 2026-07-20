import { NextResponse } from "next/server"
import { publicFormsUseCase } from "@/app/api/useCases/publicForms/PublicFormsUseCase"
import { Output } from "@/lib/output"
import { publicFormMetricEventSchema } from "@/lib/public-forms/validation"
import {
  consumePublicFormRateLimit,
  publicFormRequestFingerprint,
} from "@/lib/public-forms/rate-limit"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params
  const rate = consumePublicFormRateLimit(
    `event:${publicId}:${publicFormRequestFingerprint(request)}`,
    { limit: 120, windowMs: 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(new Output(false, [], ["Muitas requisições"], null), {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    })
  }
  const parsed = publicFormMetricEventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(new Output(false, [], ["Evento inválido"], null), { status: 400 })
  }
  const output = await publicFormsUseCase.recordMetric(publicId, parsed.data)
  return NextResponse.json(output, { status: output.isValid ? 202 : 404 })
}
