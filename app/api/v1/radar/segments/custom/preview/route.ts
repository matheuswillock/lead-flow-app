import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { previewCustomSegmentRulesSchema } from "@/lib/radar/segment-request-schemas"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const body = await request.json().catch(() => null)
    const parsed = previewCustomSegmentRulesSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      )
    }

    const result = await customerDataPlatformUseCase.previewCustomSegmentCount(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      parsed.data.rules
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarSegmentPreviewRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno"], null),
      { status: 500 }
    )
  }
}
