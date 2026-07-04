import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppConversationTagUseCase } from "@/app/api/useCases/whatsapp/WhatsAppConversationTagUseCase"
import { WHATSAPP_TAG_COLOR_TOKENS } from "@/lib/whatsapp/tag-colors"

const updateTagSchema = z.object({
  name: z.string().trim().min(1).optional(),
  color: z.enum(WHATSAPP_TAG_COLOR_TOKENS).optional(),
  sortOrder: z.number().int().optional(),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está ativo") || msg.includes("Apenas gestores")) return 403
  return 400
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; tagId: string }> }
) {
  const { teamId, tagId } = await params
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

  const parsed = updateTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await whatsAppConversationTagUseCase.update({
    teamId,
    tagId,
    access: teamAccess.access,
    name: parsed.data.name,
    color: parsed.data.color,
    sortOrder: parsed.data.sortOrder,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; tagId: string }> }
) {
  const { teamId, tagId } = await params
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

  const output = await whatsAppConversationTagUseCase.delete({
    teamId,
    tagId,
    access: teamAccess.access,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}
