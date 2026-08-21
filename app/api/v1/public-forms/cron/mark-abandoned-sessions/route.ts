import { NextResponse, type NextRequest, connection } from "next/server"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { markAbandonedJourneySessionsUseCase } from "@/app/api/useCases/publicFormJourney/markAbandonedJourneySessionsFactory"
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
        cronKey: "public-forms-mark-abandoned-sessions",
        cronPath: "/api/v1/public-forms/cron/mark-abandoned-sessions",
      },
      () => markAbandonedJourneySessionsUseCase.execute(),
      { onFailure: getDefaultCronSlackCallback() },
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[PublicFormsCronMarkAbandonedSessionsRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de abandono de jornadas"], null),
      { status: 500 },
    )
  }
}
