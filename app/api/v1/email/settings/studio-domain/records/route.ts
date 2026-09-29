import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTeamSettingsUseCase } from "@/app/api/useCases/email/EmailTeamSettingsUseCase"
import { TeamStudioDomainUseCase } from "@/app/api/useCases/email/TeamStudioDomainUseCase"
import { invalidateTeamStudioDomainCache } from "@/lib/cache/invalidation"
import { studioDomainOutputStatus } from "../response"

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    const emailOutput = await new EmailTeamSettingsUseCase().get(teamAccess.access)
    const emailResult = emailOutput.result as { resendDomainName?: string | null; resendDomainStatus?: string | null } | null
    const output = await new TeamStudioDomainUseCase({ invalidateCache: invalidateTeamStudioDomainCache }).getRecordsForEmailDomain(
      teamAccess.access,
      {
        name: emailResult?.resendDomainName,
        status: emailResult?.resendDomainStatus,
      },
    )
    return NextResponse.json(output, { status: studioDomainOutputStatus(output) })
  } catch (error) {
    console.error("[EmailStudioDomainRecordsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
