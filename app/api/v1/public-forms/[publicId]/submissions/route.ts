import { NextResponse, after } from "next/server"
import {
  publicFormSubmissionUseCase,
  type PublicFormSubmissionBackgroundJob,
} from "@/app/api/useCases/publicForms/PublicFormSubmissionUseCase"
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
  const rate = await consumePublicFormRateLimit(
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
  const output = await publicFormSubmissionUseCase.accept(publicId, parsed.data)
  if (!output.isValid) {
    return NextResponse.json(output, { status: 400 })
  }

  const background = (output.result as { background?: PublicFormSubmissionBackgroundJob } | null)
    ?.background
  if (background) {
    // PR2.3: after() só publica na fila (sem lead match/agendamento no isolate
    // do HTTP). Publish-with-retry + outbox fallback vivem no UseCase, não na
    // route (governança: route só chama UseCase).
    after(() => publicFormSubmissionUseCase.queueForBackgroundProcessing(background))
  }

  return NextResponse.json(
    new Output(true, ["Respostas recebidas"], [], {
      submissionId: (output.result as { submissionId?: string } | null)?.submissionId ?? null,
    }),
    { status: 201 },
  )
}
