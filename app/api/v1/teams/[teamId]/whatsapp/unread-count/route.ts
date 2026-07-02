import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { getWhatsAppUnreadCountUseCase } from "@/app/api/useCases/whatsapp/GetWhatsAppUnreadCountUseCase"

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

  const output = await getWhatsAppUnreadCountUseCase.execute({
    teamId,
    access: teamAccess.access,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: 500 })
  }

  return NextResponse.json(output)
}
