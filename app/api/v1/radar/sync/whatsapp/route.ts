import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { invalidateRadarSegmentsCache } from "@/lib/cache/invalidation"

export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const result = await customerDataPlatformUseCase.syncWhatsapp(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access)
    )

    if (result.isValid) {
      invalidateRadarSegmentsCache({ teamId: radarAccess.access.teamId })
    }

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarSyncWhatsappRoute][POST]", error)
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null },
      { status: 500 }
    )
  }
}
