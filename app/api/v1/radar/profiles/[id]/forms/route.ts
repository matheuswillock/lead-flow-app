import { NextResponse, type NextRequest, connection } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { listRadarProfileFormsUseCase } from "@/app/api/useCases/radar/ListRadarProfileFormsUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection()

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { id } = await params
    const result = await listRadarProfileFormsUseCase.execute({
      profileId: id,
      teamId: radarAccess.access.teamId,
      ctx: teamContextFromRadarAccess(radarAccess.access),
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarProfileFormsRoute][GET]", error)
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null },
      { status: 500 },
    )
  }
}
