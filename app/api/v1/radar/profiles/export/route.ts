import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { parseRadarProfilesExportQuery } from "@/lib/radar/parseRadarProfilesExportQuery"

export async function GET(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const parsed = parseRadarProfilesExportQuery(searchParams)
    if (!parsed.ok) {
      return NextResponse.json(new Output(false, [], [parsed.error], null), { status: 400 })
    }

    const result = await customerDataPlatformUseCase.exportProfiles({
      teamId: radarAccess.access.teamId,
      ctx: teamContextFromRadarAccess(radarAccess.access),
      search: parsed.value.search,
      consent: parsed.value.consent,
      sourceType: parsed.value.sourceType,
      channel: parsed.value.channel,
      lastSeenFrom: parsed.value.lastSeenFrom,
      lastSeenTo: parsed.value.lastSeenTo,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarProfilesExportRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
