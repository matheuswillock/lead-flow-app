import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { getMessagesUseCase } from "@/app/api/useCases/whatsapp/GetMessagesUseCase"
import { sendMessageUseCase } from "@/app/api/useCases/whatsapp/SendMessageUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const conversationIdSchema = z.string().uuid("ID da conversa inválido")

const mediaSchema = z.object({
  mediatype: z.enum(["image", "document", "audio", "video"]),
  mimeType: z.string().min(1),
  fileName: z.string().min(1),
  base64: z.string().min(1),
  caption: z.string().max(4096).optional(),
})

const sendMessageSchema = z.union([
  z.object({
    conversationId: conversationIdSchema,
    contentText: z.string().min(1, "Mensagem não pode ser vazia").max(4096),
    mentionedJids: z.array(z.string().min(1)).optional(),
  }),
  z
    .object({
      conversationId: conversationIdSchema,
      contentText: z.string().max(4096).optional(),
      mentionedJids: z.array(z.string().min(1)).optional(),
      media: mediaSchema,
    })
    .refine((data) => Boolean(data.media), { message: "Mídia é obrigatória" }),
])

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("Acesso negado")) return 403
  if (msg.includes("não está conectado")) return 409
  if (msg.includes("Erro interno") || msg.includes("inesperado")) return 500
  return 400
}

async function assertTeamAccess(request: NextRequest, teamId: string) {
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) {
    return { error: NextResponse.json(teamAccess.error, { status: teamAccess.status }) }
  }

  if (teamAccess.access.teamId !== teamId) {
    return {
      error: NextResponse.json(
        new Output(false, [], ["Acesso negado a este time"], null),
        { status: 403 }
      ),
    }
  }

  return { access: teamAccess.access }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const accessResult = await assertTeamAccess(request, teamId)
    if ("error" in accessResult) return accessResult.error

    const url = new URL(request.url)
    const conversationId = url.searchParams.get("conversationId")
    const parsedConversationId = conversationIdSchema.safeParse(conversationId)
    if (!parsedConversationId.success) {
      return NextResponse.json(
        new Output(false, [], ["conversationId é obrigatório"], null),
        { status: 400 }
      )
    }

    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100)

    const output = await getMessagesUseCase.execute({
      conversationId: parsedConversationId.data,
      teamId,
      access: accessResult.access,
      page,
      limit,
    })
    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveStatus(output) })
    }

    return NextResponse.json(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppMessagesRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao buscar mensagens"], null),
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const accessResult = await assertTeamAccess(request, teamId)
    if ("error" in accessResult) return accessResult.error

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
      conversationId: parsed.data.conversationId,
      teamId,
      sentByProfileId: accessResult.access.profileId,
      access: accessResult.access,
      contentText: parsed.data.contentText,
      mentionedJids: parsed.data.mentionedJids,
      media: "media" in parsed.data ? parsed.data.media : undefined,
    })

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveStatus(output) })
    }

    return NextResponse.json(output, { status: 201 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppMessagesRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao enviar mensagem"], null),
      { status: 500 }
    )
  }
}
