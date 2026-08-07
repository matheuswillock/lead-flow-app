import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
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
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))

    const result = await customerDataPlatformUseCase.listCustomSegmentProfiles(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      segmentId,
      page,
      pageSize
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarCustomSegmentProfilesRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno"], null),
      { status: 500 }
    )
  }
}
