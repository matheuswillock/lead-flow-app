import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { setConversationTagsUseCase } from "@/app/api/useCases/whatsapp/SetConversationTagsUseCase"

const setTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
})

export async function PUT(
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

  const parsed = setTagsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await setConversationTagsUseCase.execute({
    teamId,
    conversationId,
    tagIds: parsed.data.tagIds,
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
