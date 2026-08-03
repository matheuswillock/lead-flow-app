import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") ?? undefined
    const consent = searchParams.get("consent") as "allowed" | "blocked" | "unknown" | null
    const sourceType = searchParams.get("sourceType") ?? undefined
    const channel = searchParams.get("channel") as "email" | "whatsapp" | null
    const lastSeenFrom = searchParams.get("lastSeenFrom") ?? undefined
    const lastSeenTo = searchParams.get("lastSeenTo") ?? undefined

    const result = await customerDataPlatformUseCase.exportProfiles({
      teamId: radarAccess.access.teamId,
      ctx: teamContextFromRadarAccess(radarAccess.access),
      search,
      consent: consent ?? undefined,
      sourceType,
      channel: channel ?? undefined,
      lastSeenFrom,
      lastSeenTo,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarProfilesExportRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
