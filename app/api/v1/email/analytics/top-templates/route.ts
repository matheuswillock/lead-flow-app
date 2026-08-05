import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { emailAnalyticsUseCase } from "@/app/api/useCases/email/EmailAnalyticsUseCase"

function getDefaultFrom(tz: string): Date {
  return startOfDayInTz(addDaysInTz(new Date(), -30, tz), tz)
}

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")

    const from = fromParam ? new Date(fromParam) : getDefaultFrom(teamAccess.access.userTimezone)
    const to = toParam ? new Date(toParam) : new Date()

    const result = await emailAnalyticsUseCase.getTopTemplates({
      teamId: teamAccess.access.teamId,
      from,
      to,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailAnalyticsTopTemplatesRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
