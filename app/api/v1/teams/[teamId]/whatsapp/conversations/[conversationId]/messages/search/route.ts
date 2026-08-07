import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { searchConversationMessagesUseCase } from "@/app/api/useCases/whatsapp/SearchConversationMessagesUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

function resolveStatus(output: Output): number {
  const code = (output.result as { code?: string } | null)?.code
  if (code === "ACCESS_DENIED") return 403
  if (code === "INTERNAL_ERROR") return 500
  if (output.errorMessages.some((m) => m.includes("não encontrada") || m.includes("Acesso negado"))) {
    return output.errorMessages.some((m) => m.includes("Acesso negado")) ? 403 : 404
  }
  return 400
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; conversationId: string }> }
) {
  await connection();

  try {
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

    if (!isWhatsAppV3Enabled("search", teamId)) {
      return NextResponse.json(
        new Output(false, [], ["Busca V3 ainda não está habilitada para este time."], null),
        { status: 404 }
      )
    }

    const url = new URL(request.url)
    const q = url.searchParams.get("q") ?? ""
    const page = parseInt(url.searchParams.get("page") ?? "1", 10)
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10), 100)

    const output = await searchConversationMessagesUseCase.execute({
      teamId,
      conversationId,
      q,
      page: Number.isFinite(page) ? page : 1,
      limit: Number.isFinite(limit) ? limit : 20,
      access: teamAccess.access,
    })

    if (!output.isValid) {
      return NextResponse.json(output, { status: resolveStatus(output) })
    }

    return NextResponse.json(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppConversationMessagesSearchRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao buscar mensagens da conversa"], null),
      { status: 500 }
    )
  }
}
