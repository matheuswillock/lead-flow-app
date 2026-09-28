import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailTeamSettingsUseCase } from "@/app/api/useCases/email/EmailTeamSettingsUseCase"
import { TeamStudioDomainUseCase } from "@/app/api/useCases/email/TeamStudioDomainUseCase"
import { invalidateTeamStudioDomainCache } from "@/lib/cache/invalidation"

function makeStudioDomainUseCase() {
  return new TeamStudioDomainUseCase({ invalidateCache: invalidateTeamStudioDomainCache })
}

async function getContext(request: NextRequest) {
  const teamAccess = await getTeamAccess(request)
  if (teamAccess.error) return { error: teamAccess.error, access: null, emailDomainName: null, emailDomainStatus: null }
  const emailOutput = await new EmailTeamSettingsUseCase().get(teamAccess.access)
  const emailResult = emailOutput.result as { resendDomainName?: string | null; resendDomainStatus?: string | null } | null
  return {
    error: null,
    access: teamAccess.access,
    emailDomainName: emailResult?.resendDomainName ?? null,
    emailDomainStatus: emailResult?.resendDomainStatus ?? null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getContext(request)
    if (context.error) return NextResponse.json(context.error, { status: 401 })
    const output = await makeStudioDomainUseCase().getForEmailDomain(
      context.access!,
      {
        name: context.emailDomainName,
        status: context.emailDomainStatus,
      },
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 403 })
  } catch (error) {
    console.error("[EmailStudioDomainRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getContext(request)
    if (context.error) return NextResponse.json(context.error, { status: 401 })
    const body = await request.json().catch(() => null) as { headScripts?: unknown; bodyStartScripts?: unknown; bodyEndScripts?: unknown } | null
    const output = body && ("headScripts" in body || "bodyStartScripts" in body || "bodyEndScripts" in body)
      ? await makeStudioDomainUseCase().updateTracking(context.access!, body)
      : await makeStudioDomainUseCase().verify(context.access!)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[EmailStudioDomainRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
