import { NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { resolvePublicFormPrefillUseCase } from "@/app/api/useCases/publicForms/ResolvePublicFormPrefillUseCase"
import { isPublicFormRequestOriginAllowed } from "@/lib/public-forms/request-origin-guard"
import { consumePublicFormRateLimit, publicFormRequestFingerprint } from "@/lib/public-forms/rate-limit"
import { EMAIL_LOG_FORM_QUERY_PARAM } from "@/lib/email/append-email-log-to-form-urls"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  const { publicId } = await params

  if (!isPublicFormRequestOriginAllowed(request)) {
    return NextResponse.json(new Output(false, [], ["Origem não autorizada"], null), { status: 400 })
  }

  const rate = await consumePublicFormRateLimit(
    `prefill:${publicId}:${publicFormRequestFingerprint(request)}`,
    { limit: 30, windowMs: 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(new Output(false, [], ["Muitas requisições"], null), {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    })
  }

  const { searchParams } = new URL(request.url)
  const emailLogId = searchParams.get(EMAIL_LOG_FORM_QUERY_PARAM)?.trim() ?? ""

  const output = await resolvePublicFormPrefillUseCase.execute(publicId, emailLogId)
  return NextResponse.json(output, { status: output.isValid ? 200 : 404 })
}
