import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { updateTeamRadarSegmentSchema } from "@/lib/radar/segment-request-schemas"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ segmentId: string }> }

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segmentId } = await params
    const body = await request.json().catch(() => null)
    const parsed = updateTeamRadarSegmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      )
    }

    const result = await customerDataPlatformUseCase.updateCustomSegment(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      segmentId,
      parsed.data
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCustomSegmentRoute][PATCH]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno"], null),
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segmentId } = await params
    const result = await customerDataPlatformUseCase.deleteCustomSegment(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      segmentId
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCustomSegmentRoute][DELETE]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno"], null),
      { status: 500 }
    )
  }
}
