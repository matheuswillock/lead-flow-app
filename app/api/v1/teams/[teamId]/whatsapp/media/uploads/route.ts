import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { createMediaUploadUseCase } from "@/app/api/useCases/whatsapp/CreateMediaUploadUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

const createUploadSchema = z.object({
  conversationId: z.string().uuid("ID da conversa inválido"),
  clientMessageId: z.string().uuid("clientMessageId inválido"),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, "sha256 inválido"),
})

function resolveStatus(output: Output): number {
  const code = (output.result as { code?: string } | null)?.code
  if (code === "ACCESS_DENIED") return 403
  if (code === "CONVERSATION_NOT_FOUND") return 404
  if (code === "MEDIA_TOO_LARGE" || code === "MEDIA_UNSUPPORTED") return 422
  if (code === "INTERNAL_ERROR") return 500
  return 400
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
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
    if (!isWhatsAppV3Enabled("send", teamId)) {
      return NextResponse.json(
        new Output(false, [], ["Upload V3 ainda não está habilitado para este time."], null),
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

    const parsed = createUploadSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((i) => i.message), null),
        { status: 400 }
      )
    }

    const output = await createMediaUploadUseCase.execute({
      teamId,
      access: teamAccess.access,
      ...parsed.data,
    })
    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveStatus(output) })
    }
    return NextResponse.json(output, { status: 201 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppMediaUploadsRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao preparar upload"], null),
      { status: 500 }
    )
  }
}
