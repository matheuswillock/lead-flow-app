import { NextResponse, type NextRequest } from "next/server"
import { getCdpAccess, teamContextFromCdpAccess } from "@/app/api/v1/cdp/utils/getCdpAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"

export async function GET(request: NextRequest) {
  try {
    const cdpAccess = await getCdpAccess(request)
    if (cdpAccess.error) {
      return NextResponse.json(cdpAccess.error, { status: cdpAccess.status })
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

    const result = await customerDataPlatformUseCase.listProfiles({
      teamId: cdpAccess.access.teamId,
      ctx: teamContextFromCdpAccess(cdpAccess.access),
      search,
      consent: consent ?? undefined,
      sourceType,
      channel: channel ?? undefined,
      lastSeenFrom,
      lastSeenTo,
      page,
      pageSize,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[CdpProfilesRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
