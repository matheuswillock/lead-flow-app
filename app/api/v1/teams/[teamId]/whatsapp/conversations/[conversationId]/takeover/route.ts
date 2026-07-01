import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { takeoverConversationUseCase } from "@/app/api/useCases/whatsapp/TakeoverConversationUseCase"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; conversationId: string }> }
) {
  const { teamId, conversationId } = await params
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

  const output = await takeoverConversationUseCase.execute({
    teamId,
    conversationId,
    profileId: teamAccess.access.profileId,
    access: teamAccess.access,
  })

  if (!output.isValid) {
    const status = output.errorMessages.some((m) => m.includes("Acesso negado"))
      ? 403
      : output.errorMessages.some((m) => m.includes("não encontrada"))
        ? 404
        : 400
    return NextResponse.json(output, { status })
  }

  return NextResponse.json(output)
}
