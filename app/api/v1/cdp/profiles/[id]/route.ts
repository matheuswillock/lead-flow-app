import { NextResponse, type NextRequest } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"

type RouteParams = { params: Promise<{ id: string }> }

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

    const { id } = await params
    const result = await customerDataPlatformUseCase.getProfile(
      teamAccess.access.teamId,
      teamContextFromAccess(teamAccess.access),
      id
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 404 })
  } catch (error) {
    console.error("[CdpProfileByIdRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
