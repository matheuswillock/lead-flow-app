import { NextResponse, type NextRequest, connection } from "next/server"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { publicFormSubmissionDispatchUseCase } from "@/app/api/useCases/publicFormSubmissionDispatch/PublicFormSubmissionDispatchUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { Output } from "@/lib/output"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  await connection()

  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const result = await withCronAudit(
      {
        cronKey: "public-forms-submission-dispatch",
        cronPath: "/api/v1/public-forms/cron/dispatch-pending-submissions",
      },
      () => publicFormSubmissionDispatchUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PublicFormsCronDispatchPendingSubmissionsRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de despacho de submissões públicas"], null),
      { status: 500 },
    )
  }
}
