import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { markConversationReadUseCase } from "@/app/api/useCases/whatsapp/MarkConversationReadUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const readSchema = z.object({
  conversationId: z.string().uuid("ID da conversa inválido"),
})

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

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        new Output(false, [], ["Corpo da requisição inválido"], null),
        { status: 400 }
      )
    }

    const parsed = readSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      )
    }

    const output = await markConversationReadUseCase.execute(
      parsed.data.conversationId,
      teamAccess.access
    )

    if (!output.isValid) {
      const status = output.errorMessages.some((m) => m.includes("não encontrad"))
        ? 404
        : output.errorMessages.some((m) => m.includes("Acesso negado"))
          ? 403
          : 500
      return NextResponse.json(output, { status })
    }

    return NextResponse.json(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[WhatsAppConversationReadRoute][POST]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro ao marcar conversa como lida"], null),
      { status: 500 }
    )
  }
}
