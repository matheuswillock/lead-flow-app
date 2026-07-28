import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { getMessagesUseCase } from "@/app/api/useCases/whatsapp/GetMessagesUseCase"
import { sendMessageUseCase } from "@/app/api/useCases/whatsapp/SendMessageUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

const conversationIdSchema = z.string().uuid("ID da conversa inválido")

const mediaSchema = z.object({
  mediatype: z.enum(["image", "document", "audio", "video"]),
  mimeType: z.string().min(1),
  fileName: z.string().min(1),
  storagePath: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "sha256 inválido"),
  sizeBytes: z.number().int().positive(),
  caption: z.string().max(4096).optional(),
})

const sendMessageSchema = z.union([
  z.object({
    conversationId: conversationIdSchema,
    clientMessageId: z.string().uuid("clientMessageId inválido"),
    retryFailed: z.boolean().optional(),
    quotedMessageId: z.string().uuid().optional(),
    contentText: z.string().max(4096).optional(),
    mentionedJids: z.array(z.string().min(1)).optional(),
    media: mediaSchema,
  }),
  z.object({
    conversationId: conversationIdSchema,
    clientMessageId: z.string().uuid("clientMessageId inválido"),
    retryFailed: z.boolean().optional(),
    quotedMessageId: z.string().uuid().optional(),
    contentText: z.string().min(1, "Mensagem não pode ser vazia").max(4096),
    mentionedJids: z.array(z.string().min(1)).optional(),
  }),
])

function resolveStatus(output: Output): number {
  const code = (output.result as { code?: string } | null)?.code
  if (code === "ACCESS_DENIED") return 403
  if (code === "CONVERSATION_NOT_FOUND") return 404
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") return 429
  if (code === "PROVIDER_OFFLINE" || code === "IDEMPOTENCY_CONFLICT") return 409
  if (code === "MEDIA_TOO_LARGE" || code === "MEDIA_UNSUPPORTED" || code === "MEDIA_UNAVAILABLE") return 422
  if (code === "INTERNAL_ERROR") return 500
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
    if (!isWhatsAppV3Enabled("send", teamId)) {
      return NextResponse.json(
        new Output(false, [], ["Envio V3 ainda não está habilitado para este time."], null),
        { status: 404 }
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
      conversationId: parsed.data.conversationId,
      clientMessageId: parsed.data.clientMessageId,
      retryFailed: parsed.data.retryFailed,
      quotedMessageId: parsed.data.quotedMessageId,
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

    const result = output.result as { status?: string; idempotentReplay?: boolean } | null
    if (result?.status === "PENDING" || result?.status === "UNKNOWN") {
      return NextResponse.json(output, { status: 202 })
    }
    return NextResponse.json(output, { status: result?.idempotentReplay ? 200 : 201 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppMessagesRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao enviar mensagem"], null),
      { status: 500 }
    )
  }
}
