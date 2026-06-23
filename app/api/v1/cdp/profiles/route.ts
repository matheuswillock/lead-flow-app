import { NextResponse, type NextRequest } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"

function teamContextFromAccess(access: NonNullable<Awaited<ReturnType<typeof getTeamAccess>>["access"]>) {
  return {
    profileId: access.profileId,
    userTimezone: access.userTimezone,
    teamMember: {
      role: access.teamMember.role,
      functions: access.teamMember.functions,
    },
  }
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))
    const search = searchParams.get("search") ?? undefined
    const consent = searchParams.get("consent") as "allowed" | "blocked" | "unknown" | null
    const sourceType = searchParams.get("sourceType") ?? undefined

    const result = await customerDataPlatformUseCase.listProfiles({
      teamId: teamAccess.access.teamId,
      ctx: teamContextFromAccess(teamAccess.access),
      search,
      consent: consent ?? undefined,
      sourceType,
      page,
      pageSize,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[CdpProfilesRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
