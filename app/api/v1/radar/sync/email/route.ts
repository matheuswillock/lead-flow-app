import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { parseRadarSyncFilters } from "@/lib/radar/sync-filters"
import { invalidateRadarSegmentsCache } from "@/lib/cache/invalidation"

export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const body = await request.json().catch(() => ({}))
    const filters = parseRadarSyncFilters(body)

    const result = await customerDataPlatformUseCase.syncEmail(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      filters
    )

    if (result.isValid) {
      invalidateRadarSegmentsCache({ teamId: radarAccess.access.teamId })
    }

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[RadarSyncEmailRoute][POST]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
