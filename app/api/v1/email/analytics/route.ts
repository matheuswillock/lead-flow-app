import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { emailAnalyticsUseCase } from "@/app/api/useCases/email/EmailAnalyticsUseCase"

function getDefaultFrom(tz: string): Date {
  return startOfDayInTz(addDaysInTz(new Date(), -30, tz), tz)
}

export async function GET(request: NextRequest) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const campaignId = searchParams.get("campaignId") ?? undefined

    const from = fromParam ? new Date(fromParam) : getDefaultFrom(teamAccess.access.userTimezone)
    const to = toParam ? new Date(toParam) : new Date()

    const result = await emailAnalyticsUseCase.getAnalytics({
      teamId: teamAccess.access.teamId,
      from,
      to,
      campaignId,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailAnalyticsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
