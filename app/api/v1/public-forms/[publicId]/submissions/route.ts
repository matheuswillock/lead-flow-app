import { NextResponse } from "next/server"
import { publicFormSubmissionUseCase } from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
import { Output } from "@/lib/output"
import { publicFormSubmissionSchema } from "@/lib/public-forms/validation"
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
    `submission:${publicId}:${publicFormRequestFingerprint(request)}`,
    { limit: 10, windowMs: 10 * 60_000 },
  )
  if (!rate.allowed) {
    return NextResponse.json(
      new Output(false, [], ["Muitas tentativas. Tente novamente depois."], null),
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    )
  }
  const parsed = publicFormSubmissionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      new Output(
        false,
        [],
        parsed.error.issues.map((issue) => issue.message),
        null,
      ),
      { status: 400 },
    )
  }
  const output = await publicFormSubmissionUseCase.execute(publicId, parsed.data)
  return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
}
