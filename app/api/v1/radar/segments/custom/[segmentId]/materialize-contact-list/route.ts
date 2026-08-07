import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { materializeSegmentToContactListUseCase } from "@/app/api/useCases/radar/MaterializeSegmentToContactListUseCase"
import { CUSTOM_RADAR_SEGMENT_PREFIX } from "@/lib/radar/segment-audience"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ segmentId: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection();

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segmentId } = await params
    const segmentSlug = `${CUSTOM_RADAR_SEGMENT_PREFIX}${segmentId}`
    const result = await materializeSegmentToContactListUseCase.preview(
      radarAccess.access.teamId,
      segmentSlug
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCustomSegmentMaterializeRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segmentId } = await params
    const segmentSlug = `${CUSTOM_RADAR_SEGMENT_PREFIX}${segmentId}`
    const ctx = teamContextFromRadarAccess(radarAccess.access)
    const result = await materializeSegmentToContactListUseCase.execute(
      radarAccess.access.teamId,
      segmentSlug,
      ctx
    )

    return NextResponse.json(result, { status: result.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCustomSegmentMaterializeRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
