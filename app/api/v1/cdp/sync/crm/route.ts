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

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const result = await customerDataPlatformUseCase.syncCrm(
      teamAccess.access.teamId,
      teamContextFromAccess(teamAccess.access)
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[CdpSyncCrmRoute][POST]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
