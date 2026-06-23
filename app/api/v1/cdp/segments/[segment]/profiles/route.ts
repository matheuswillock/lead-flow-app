import { NextResponse, type NextRequest } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"

type RouteParams = { params: Promise<{ segment: string }> }

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

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { segment } = await params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))

    const result = await customerDataPlatformUseCase.listSegmentProfiles(
      teamAccess.access.teamId,
      teamContextFromAccess(teamAccess.access),
      segment,
      page,
      pageSize
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[CdpSegmentProfilesRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
