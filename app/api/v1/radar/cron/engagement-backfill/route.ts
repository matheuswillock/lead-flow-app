import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { radarEngagementBackfillUseCase } from "@/app/api/useCases/radar/RadarEngagementBackfillUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { withCronAudit } from "@/app/api/lib/cron/withCronAudit"
import { getDefaultCronSlackCallback } from "@/app/api/lib/cron/cronSlackCallback"

export const maxDuration = 300

async function handleEngagementBackfillCron(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
  }

  const result = await withCronAudit(
    {
      cronKey: "engagement-backfill",
      cronPath: "/api/v1/radar/cron/engagement-backfill",
    },
    () => radarEngagementBackfillUseCase.execute(),
    {
      onFailure: getDefaultCronSlackCallback(),
    }
  )
  return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
}

export async function GET(request: NextRequest) {
  try {
    return await handleEngagementBackfillCron(request)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCronEngagementBackfillRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de backfill de engajamento"], null),
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handleEngagementBackfillCron(request)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCronEngagementBackfillRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de backfill de engajamento"], null),
      { status: 500 }
    )
  }
}
