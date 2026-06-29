import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { deleteConversationUseCase } from "@/app/api/useCases/whatsapp/DeleteConversationUseCase"
import { isManagerLikeRole } from "@/lib/roles"

export async function DELETE(
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
      new Output(false, [], ["Apenas gerentes ou masters podem excluir conversas"], null),
      { status: 403 }
    )
  }

  const output = await deleteConversationUseCase.execute({ conversationId })

  if (!output.isValid) {
    return NextResponse.json(output, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
