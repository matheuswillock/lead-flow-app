import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { searchWhatsAppInboxUseCase } from "@/app/api/useCases/whatsapp/SearchWhatsAppInboxUseCase"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(new Output(false, [], ["Acesso negado a este time"], null), { status: 403 })
  }
  const output = await searchWhatsAppInboxUseCase.execute({
    teamId,
    access: teamAccess.access,
    query: new URL(request.url).searchParams.get("q") ?? "",
  })
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
