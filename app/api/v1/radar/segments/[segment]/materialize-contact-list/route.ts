import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { materializeSegmentToContactListUseCase } from "@/app/api/useCases/radar/MaterializeSegmentToContactListUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ segment: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection();

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segment } = await params
    const result = await materializeSegmentToContactListUseCase.preview(
      radarAccess.access.teamId,
      segment
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarSystemSegmentMaterializeRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segment } = await params
    const ctx = teamContextFromRadarAccess(radarAccess.access)
    const result = await materializeSegmentToContactListUseCase.execute(
      radarAccess.access.teamId,
      segment,
      ctx
    )

    return NextResponse.json(result, { status: result.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarSystemSegmentMaterializeRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
