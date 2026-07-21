import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { listWhatsAppContactsUseCase } from "@/app/api/useCases/whatsapp/ListWhatsAppContactsUseCase"

function resolveStatus(output: Output): number {
  const msg = output.errorMessages.join(" ")
  if (msg.includes("não encontrad")) return 404
  if (msg.includes("não está conectado")) return 409
  if (msg.includes("Erro interno") || msg.includes("inesperado")) return 500
  return 400
}

export async function GET(
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

  const url = new URL(request.url)
  const q = url.searchParams.get("q") ?? undefined
  const groupJid = url.searchParams.get("groupJid") ?? undefined

  const output = await listWhatsAppContactsUseCase.execute({
    teamId,
    access: teamAccess.access,
    q,
    groupJid,
  })
  if (!output.isValid) {
    return NextResponse.json(output, { status: resolveStatus(output) })
  }

  return NextResponse.json(output)
}
