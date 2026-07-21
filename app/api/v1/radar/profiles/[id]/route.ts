import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { id } = await params
    const result = await customerDataPlatformUseCase.getProfile(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      id
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarProfileByIdRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
