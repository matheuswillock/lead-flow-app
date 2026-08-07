import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { radarPixelUseCase } from "@/app/api/useCases/radar/RadarPixelUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection();

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const result = await radarPixelUseCase.getHitLogs(radarAccess.access.teamId)
    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarPixelLogsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
