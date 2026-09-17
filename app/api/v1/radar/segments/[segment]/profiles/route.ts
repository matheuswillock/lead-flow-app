import { NextResponse, type NextRequest, connection } from "next/server";
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import { parsePageParam, parsePageSizeParam } from "@/lib/http/parse-pagination"

type RouteParams = { params: Promise<{ segment: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  await connection();

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { segment } = await params
    const { searchParams } = new URL(request.url)
    // A paginação agora vira LIMIT/OFFSET no banco: `Number("abc")` é NaN e
    // sobrevive a Math.max/min, então o clamp ingênuo transformaria query
    // string malformada em erro do Postgres (500).
    const page = parsePageParam(searchParams.get("page"))
    const pageSize = parsePageSizeParam(searchParams.get("pageSize"))

    const result = await customerDataPlatformUseCase.listSegmentProfiles(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      decodeURIComponent(segment),
      page,
      pageSize
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarSegmentProfilesRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
