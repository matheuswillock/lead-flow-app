import { NextRequest, NextResponse, connection } from "next/server";
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { whatsAppConversationTagUseCase } from "@/app/api/useCases/whatsapp/WhatsAppConversationTagUseCase"
import { WHATSAPP_TAG_COLOR_TOKENS } from "@/lib/whatsapp/tag-colors"

const createTagSchema = z.object({
  name: z.string().trim().min(1, "Nome da tag é obrigatório"),
  color: z.enum(WHATSAPP_TAG_COLOR_TOKENS),
  sortOrder: z.number().int().optional(),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está ativo") || msg.includes("Apenas gestores")) return 403
  return 400
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  await connection();

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

  const output = await whatsAppConversationTagUseCase.list({
    teamId,
    access: teamAccess.access,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}

export async function POST(
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      new Output(false, [], ["Corpo da requisição inválido"], null),
      { status: 400 }
    )
  }

  const parsed = createTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
      { status: 400 }
    )
  }

  const output = await whatsAppConversationTagUseCase.create({
    teamId,
    access: teamAccess.access,
    name: parsed.data.name,
    color: parsed.data.color,
    sortOrder: parsed.data.sortOrder,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output, { status: 201 })
}
