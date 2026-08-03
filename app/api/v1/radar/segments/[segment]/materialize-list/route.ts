import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { radarSegmentMaterializeUseCase } from "@/app/api/useCases/radar/RadarSegmentMaterializeUseCase"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ segment: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segment } = await params
    const body = (await request.json().catch(() => ({}))) as { name?: string }

    const result = await radarSegmentMaterializeUseCase.execute({
      teamId: radarAccess.access.teamId,
      ctx: radarAccess.access,
      segmentSlug: decodeURIComponent(segment),
      name: body.name,
    })

    return NextResponse.json(result, { status: result.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarSegmentMaterializeRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
