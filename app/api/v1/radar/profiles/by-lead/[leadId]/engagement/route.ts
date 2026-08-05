import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { getLeadRadarEngagementUseCase } from "@/app/api/useCases/radar/GetLeadRadarEngagementUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ leadId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { leadId } = await params
    const result = await getLeadRadarEngagementUseCase.execute({
      teamId: radarAccess.access.teamId,
      ctx: teamContextFromRadarAccess(radarAccess.access),
      leadId,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarLeadEngagementRoute][GET]", error)
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null },
      { status: 500 }
    )
  }
}
