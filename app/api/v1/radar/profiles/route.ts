import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))
    const search = searchParams.get("search") ?? undefined
    const consent = searchParams.get("consent") as "allowed" | "blocked" | "unknown" | null
    const sourceType = searchParams.get("sourceType") ?? undefined
    const channel = searchParams.get("channel") as "email" | "whatsapp" | null
    const lastSeenFrom = searchParams.get("lastSeenFrom") ?? undefined
    const lastSeenTo = searchParams.get("lastSeenTo") ?? undefined
    const sortParam = searchParams.get("sort")
    const orderParam = searchParams.get("order")
    const sort =
      sortParam === "lastSeenAt" || sortParam === "engagementScore" ? sortParam : "engagementScore"
    const order = orderParam === "asc" || orderParam === "desc" ? orderParam : "desc"

    const result = await customerDataPlatformUseCase.listProfiles({
      teamId: radarAccess.access.teamId,
      ctx: teamContextFromRadarAccess(radarAccess.access),
      search,
      consent: consent ?? undefined,
      sourceType,
      channel: channel ?? undefined,
      lastSeenFrom,
      lastSeenTo,
      page,
      pageSize,
      sort,
      order,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarProfilesRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
