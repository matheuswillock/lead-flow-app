import { NextRequest, NextResponse } from "next/server"
import { getTeamAccess, type TeamAccess } from "@/app/api/v1/utils/teamAccess"
import { Output } from "@/lib/output"

export async function resolvePublicFormsAccess(
  request: NextRequest,
  params: Promise<{ teamId: string }>,
): Promise<{ access: TeamAccess } | { response: NextResponse }> {
  const teamAccess = await getTeamAccess(request)
  if (teamAccess.error) {
    return { response: NextResponse.json(teamAccess.error, { status: teamAccess.status }) }
  }
  const { teamId } = await params
  if (teamId !== teamAccess.access.teamId) {
    return {
      response: NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), {
        status: 403,
      }),
    }
  }
  return { access: teamAccess.access }
}

export function outputResponse(output: Output, successStatus = 200) {
  return NextResponse.json(output, { status: output.isValid ? successStatus : 400 })
}
