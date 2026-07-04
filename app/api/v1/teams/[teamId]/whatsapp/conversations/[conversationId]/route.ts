import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { deleteConversationUseCase } from "@/app/api/useCases/whatsapp/DeleteConversationUseCase"
import { updateConversationContactNameUseCase } from "@/app/api/useCases/whatsapp/UpdateConversationContactNameUseCase"
import { isManagerLikeRole } from "@/lib/roles"

const patchContactNameSchema = z.object({
  contactName: z.string().trim().min(1, "Nome do contato é obrigatório"),
})

export async function PATCH(
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      new Output(false, [], ["Corpo da requisição inválido"], null),
      { status: 400 }
    )
  }

  const parsed = patchContactNameSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((i) => i.message), null),
      { status: 400 }
    )
  }

  const output = await updateConversationContactNameUseCase.execute({
    conversationId,
    teamId,
    contactName: parsed.data.contactName,
    access: teamAccess.access,
  })

  if (!output.isValid) {
    const isNotFound = output.errorMessages.some((m) => m.includes("não encontrada"))
    const isAuthz = output.errorMessages.some(
      (m) => m.includes("Acesso negado") || m.includes("não encontrada")
    )
    const status = isAuthz && !isNotFound ? 403 : isNotFound ? 404 : 400
    return NextResponse.json(output, { status })
  }

  return NextResponse.json(output)
}

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

  const output = await deleteConversationUseCase.execute({
    conversationId,
    teamId,
    access: teamAccess.access,
  })

  if (!output.isValid) {
    const isNotFound = output.errorMessages.some((m) => m.includes("não encontrada"))
    const isAuthz = output.errorMessages.some(
      (m) => m.includes("Acesso negado") || m.includes("não encontrada")
    )
    const status = isAuthz && !isNotFound ? 403 : isNotFound ? 404 : 500
    return NextResponse.json(output, { status })
  }

  return new NextResponse(null, { status: 204 })
}
