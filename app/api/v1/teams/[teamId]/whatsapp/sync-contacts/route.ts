import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { syncWhatsAppContactsUseCase } from "@/app/api/useCases/whatsapp/SyncWhatsAppContactsUseCase"
import { denyIfCannotManageWhatsAppInfrastructure } from "@/app/api/v1/teams/[teamId]/whatsapp/utils/requireWhatsAppInfrastructureAccess"

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
})

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está conectado")) return 409
  if (msg.includes("Erro interno") || msg.includes("inesperado")) return 500
  return 400
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

  const denied = denyIfCannotManageWhatsAppInfrastructure(teamAccess.access)
  if (denied) return denied

  let body: unknown = {}
  try {
    const text = await request.text()
    if (text.trim()) {
      body = JSON.parse(text)
    }
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

  const output = await syncWhatsAppContactsUseCase.execute({
    teamId,
    conversationId: parsed.data.conversationId,
  })

  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}
