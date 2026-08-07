import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { searchWhatsAppInboxUseCase } from "@/app/api/useCases/whatsapp/SearchWhatsAppInboxUseCase"
import { isWhatsAppV3Enabled } from "@/lib/whatsapp/v3-flags"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  await connection();

  const { teamId } = await params
  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
  if (teamAccess.access.teamId !== teamId) {
    return NextResponse.json(new Output(false, [], ["Acesso negado a este time"], null), { status: 403 })
  }
  if (!isWhatsAppV3Enabled("search", teamId)) {
    return NextResponse.json(new Output(false, [], ["Busca V3 ainda não está habilitada para este time."], null), { status: 404 })
  }
  const output = await searchWhatsAppInboxUseCase.execute({
    teamId,
    access: teamAccess.access,
    query: new URL(request.url).searchParams.get("q") ?? "",
  })
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
