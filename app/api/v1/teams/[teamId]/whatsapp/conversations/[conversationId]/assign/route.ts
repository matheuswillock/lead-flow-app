import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { assignConversationUseCase } from "@/app/api/useCases/whatsapp/AssignConversationUseCase"

const assignSchema = z.object({
  profileId: z.string().uuid("ID do responsável inválido"),
})

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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      new Output(false, [], ["Corpo da requisição inválido"], null),
      { status: 400 }
    )
  }

  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((i) => i.message), null),
      { status: 400 }
    )
  }

  const { access } = teamAccess
  const output = await assignConversationUseCase.execute({
    conversationId,
    assigneeProfileId: parsed.data.profileId,
    callerIsMaster: access.isMaster,
    callerRole: access.teamMember.role,
    callerProfileId: access.profileId,
    access,
  })

  if (!output.isValid) {
    const isAuthz = output.errorMessages.some(
      (m) =>
        m.includes("só pode") ||
        m.includes("já possui") ||
        m.includes("Acesso negado")
    )
    return NextResponse.json(output, { status: isAuthz ? 403 : 500 })
  }

  return NextResponse.json(output)
}
