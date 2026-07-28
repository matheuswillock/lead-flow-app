import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { forwardMessageUseCase } from "@/app/api/useCases/whatsapp/ForwardMessageUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

const bodySchema = z.object({
  destinations: z
    .array(
      z.object({
        conversationId: z.string().uuid("conversationId inválido"),
        clientMessageId: z.string().uuid("clientMessageId inválido"),
      })
    )
    .min(1)
    .max(20),
})

function resolveStatus(output: Output): number {
  const code = (output.result as { code?: string } | null)?.code
  if (code === "ACCESS_DENIED") return 403
  if (code === "CAPABILITY_UNAVAILABLE" || code === "IDEMPOTENCY_CONFLICT") return 409
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") return 429
  if (code === "INTERNAL_ERROR") return 500
  if (output.errorMessages.some((m) => m.includes("não encontrada"))) return 404
  return 400
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; messageId: string }> }
) {
  try {
    const { teamId, messageId } = await params
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
        new Output(false, [], ["Encaminhamento V3 ainda não está habilitado para este time."], null),
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

    const parsed = bodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((i) => i.message), null),
        { status: 400 }
      )
    }

    const output = await forwardMessageUseCase.execute({
      teamId,
      messageId,
      destinations: parsed.data.destinations,
      access: teamAccess.access,
    })

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveStatus(output) })
    }

    return NextResponse.json(output, { status: 201 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppMessageForwardRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao encaminhar mensagem"], null),
      { status: 500 }
    )
  }
}
