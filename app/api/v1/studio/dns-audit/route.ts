import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { TeamStudioDomainUseCase } from "@/app/api/useCases/email/TeamStudioDomainUseCase"
import { studioDomainOutputStatus } from "@/app/api/v1/email/settings/studio-domain/response"

/**
 * Consulta o último resultado persistido para o time autenticado.
 * A reconciliação completa fica restrita à rota de cron protegida por CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status })

    const output = await new TeamStudioDomainUseCase().getRecords(teamAccess.access, null)
    return NextResponse.json(output, { status: studioDomainOutputStatus(output) })
  } catch (error) {
    console.error("[StudioDNSAuditRoute][GET]", error)
    return NextResponse.json(
      new Output(false, [], ["Erro interno ao consultar a auditoria DNS"], null),
      { status: 500 }
    )
  }
}
