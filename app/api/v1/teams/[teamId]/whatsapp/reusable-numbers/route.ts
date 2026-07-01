import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { listReusableWhatsAppNumbersUseCase } from "@/app/api/useCases/whatsapp/ListReusableWhatsAppNumbersUseCase"

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

  const output = await listReusableWhatsAppNumbersUseCase.execute({
    teamId,
    callerIsMaster: teamAccess.access.isMaster,
  })

  if (!output.isValid) {
    const status = output.errorMessages.some((m) => m.includes("master")) ? 403 : 400
    return NextResponse.json(output, { status })
  }

  return NextResponse.json(output)
}
