import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { messageActionUseCase } from "@/app/api/useCases/whatsapp/MessageActionUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

function resolveStatus(output: Output): number {
  const code = (output.result as { code?: string } | null)?.code
  if (code === "ACCESS_DENIED") return 403
  if (code === "INTERNAL_ERROR") return 500
  if (output.errorMessages.some((m) => m.includes("não encontrada"))) return 404
  return 400
}

export async function GET(
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

    const output = await messageActionUseCase.getActionsState({
      teamId,
      messageId,
      access: teamAccess.access,
    })

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveStatus(output) })
    }

    return NextResponse.json(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppMessageActionsStateRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao obter estado da mensagem"], null),
      { status: 500 }
    )
  }
}
