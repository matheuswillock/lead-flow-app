import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTeamSettingsUseCase } from "@/app/api/useCases/email/EmailTeamSettingsUseCase"
import { TeamStudioDomainUseCase } from "@/app/api/useCases/email/TeamStudioDomainUseCase"
import { invalidateTeamStudioDomainCache } from "@/lib/cache/invalidation"

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    const emailOutput = await new EmailTeamSettingsUseCase().get(teamAccess.access)
    const emailResult = emailOutput.result as { resendDomainName?: string | null; resendDomainStatus?: string | null } | null
    const useCase = new TeamStudioDomainUseCase({ invalidateCache: invalidateTeamStudioDomainCache })
    if (emailResult?.resendDomainStatus === "verified" && emailResult.resendDomainName) {
      await useCase.ensureForVerifiedEmailDomain(teamAccess.access.teamId, emailResult.resendDomainName)
    }
    const output = await useCase.getRecords(
      teamAccess.access,
      emailResult?.resendDomainName ?? null,
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 403 })
  } catch (error) {
    console.error("[EmailStudioDomainRecordsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
