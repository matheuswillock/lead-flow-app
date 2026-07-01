import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { archiveConversationUseCase } from "@/app/api/useCases/whatsapp/ArchiveConversationUseCase"
import { isManagerLikeRole } from "@/lib/roles"

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

  const { isMaster, teamMember } = teamAccess.access
  if (!isMaster && !isManagerLikeRole(teamMember.role)) {
    return NextResponse.json(
      new Output(false, [], ["Apenas gerentes ou masters podem arquivar conversas"], null),
      { status: 403 }
    )
  }

  const output = await archiveConversationUseCase.execute({ conversationId, teamId, archived: true })

  if (!output.isValid) {
    const status = output.errorMessages.some((m) => m.includes("não encontrada")) ? 404 : 500
    return NextResponse.json(output, { status })
  }

  return NextResponse.json(output)
}
