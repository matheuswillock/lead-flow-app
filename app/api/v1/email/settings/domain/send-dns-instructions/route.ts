import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { SendCustomDomainDnsInstructionsUseCase } from "@/app/api/useCases/email/SendCustomDomainDnsInstructionsUseCase"
import { isManagerLikeRole } from "@/lib/roles"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    if (!isManagerLikeRole(teamAccess.access.teamMember.role)) {
      return NextResponse.json(
        new Output(false, [], ["Apenas managers podem enviar instruções de DNS"], null),
        { status: 403 }
      )
    }

    const body = (await request.json().catch(() => null)) as {
      recipientEmail?: unknown
    } | null
    const recipientEmail = typeof body?.recipientEmail === "string" ? body.recipientEmail : ""

    const useCase = new SendCustomDomainDnsInstructionsUseCase()
    const output = await useCase.execute(teamAccess.access, { recipientEmail })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailSettingsDomainSendDnsInstructionsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
