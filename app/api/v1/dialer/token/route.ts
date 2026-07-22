import { NextRequest, NextResponse } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { dialerTokenUseCase } from "@/app/api/useCases/dialer/DialerTokenUseCase"

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { access } = teamAccess
    const output = await dialerTokenUseCase.generateToken(access.teamId, access.profileId)

    return NextResponse.json(output, { status: output.isValid ? 200 : 403 })
  } catch (error) {
    console.error("[DialerTokenRoute][GET]", error)
    return NextResponse.json(
      { isValid: false, errorMessages: ["Erro interno ao gerar token"] },
      { status: 500 },
    )
  }
}
