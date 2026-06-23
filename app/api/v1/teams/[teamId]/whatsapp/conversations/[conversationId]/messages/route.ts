import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { getMessagesUseCase } from "@/app/api/useCases/whatsapp/GetMessagesUseCase"
import { sendMessageUseCase } from "@/app/api/useCases/whatsapp/SendMessageUseCase"

const sendMessageSchema = z.object({
  contentText: z.string().min(1, "Mensagem não pode ser vazia").max(4096),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está conectado")) return 409
  if (msg.includes("Erro interno") || msg.includes("inesperado")) return 500
  return 400
}

export async function GET(
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

  const url = new URL(request.url)
  const page = parseInt(url.searchParams.get("page") ?? "1", 10)
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100)

  const output = await getMessagesUseCase.execute({ conversationId, teamId, page, limit })
  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}

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

  const parsed = sendMessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      new Output(false, [], parsed.error.issues.map((i) => i.message), null),
      { status: 400 }
    )
  }

  const output = await sendMessageUseCase.execute({
    conversationId,
    teamId,
    sentByProfileId: teamAccess.access.profileId,
    contentText: parsed.data.contentText,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output, { status: 201 })
}
