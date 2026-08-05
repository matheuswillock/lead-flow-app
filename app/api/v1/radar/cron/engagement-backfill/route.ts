import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { radarEngagementBackfillUseCase } from "@/app/api/useCases/radar/RadarEngagementBackfillUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const result = await radarEngagementBackfillUseCase.execute()
    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCronEngagementBackfillRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de backfill de engajamento"], null),
      { status: 500 }
    )
  }
}
