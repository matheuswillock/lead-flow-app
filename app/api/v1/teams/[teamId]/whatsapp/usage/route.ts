import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { getWhatsAppUsageUseCase } from "@/app/api/useCases/whatsapp/GetWhatsAppUsageUseCase"
import { denyIfCannotManageWhatsAppInfrastructure } from "@/app/api/v1/teams/[teamId]/whatsapp/utils/requireWhatsAppInfrastructureAccess"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) {
    return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  }

  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(
      new Output(false, [], ["Acesso negado a este time"], null),
      { status: 403 }
    )
  }

  const denied = denyIfCannotManageWhatsAppInfrastructure(teamAccess.access)
  if (denied) return denied

  const output = await getWhatsAppUsageUseCase.execute({ teamId })
  if (!output.isValid) {
    return NextResponse.json(output, { status: 404 })
  }

  return NextResponse.json(output)
}
