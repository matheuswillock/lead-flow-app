import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { radarBaseImportUseCase } from "@/app/api/useCases/radar/RadarBaseImportUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(new Output(false, [], ["Não autorizado"], null), { status: 401 })
    }

    const result = await radarBaseImportUseCase.processPendingJobs()
    return NextResponse.json(result, { status: result.isValid ? 200 : 500 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCronProcessImportJobsRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno no cron de importação do Radar"], null),
      { status: 500 }
    )
  }
}
