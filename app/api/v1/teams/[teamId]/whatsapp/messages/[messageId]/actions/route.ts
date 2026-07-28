import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { messageActionUseCase } from "@/app/api/useCases/whatsapp/MessageActionUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

const actionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("REACT"), emoji: z.string().min(1).max(32) }),
  z.object({ kind: z.literal("UNREACT"), emoji: z.string().min(1).max(32) }),
  z.object({
    kind: z.literal("PIN"),
    expiresAt: z.string().datetime().optional(),
  }),
  z.object({ kind: z.literal("UNPIN") }),
  z.object({ kind: z.literal("FAVORITE") }),
  z.object({ kind: z.literal("UNFAVORITE") }),
  z.object({ kind: z.literal("DELETE_FOR_ME") }),
  z.object({ kind: z.literal("DELETE_FOR_EVERYONE") }),
])

const bodySchema = z.object({
  clientActionId: z.string().uuid("clientActionId inválido"),
  action: actionSchema,
})

function resolveStatus(output: Output): number {
  const code = (output.result as { code?: string } | null)?.code
  if (code === "ACCESS_DENIED") return 403
  if (code === "CAPABILITY_UNAVAILABLE" || code === "IDEMPOTENCY_CONFLICT") return 409
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
        new Output(false, [], ["Ações V3 ainda não estão habilitadas para este time."], null),
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

    const output = await messageActionUseCase.execute({
      teamId,
      messageId,
      clientActionId: parsed.data.clientActionId,
      action: parsed.data.action,
      access: teamAccess.access,
    })

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveStatus(output) })
    }

    return NextResponse.json(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppMessageActionsRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao aplicar ação na mensagem"], null),
      { status: 500 }
    )
  }
}
