import { NextResponse, connection, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { TeamFormDomainUseCase } from "@/app/api/useCases/email/TeamFormDomainUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

function makeUseCase() {
  return new TeamFormDomainUseCase()
}

export async function GET(request: NextRequest) {
  await connection()
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const useCase = makeUseCase()
    const output = await useCase.getFormDomainRecords(teamAccess.access)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailSettingsFormDomainRecordsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
