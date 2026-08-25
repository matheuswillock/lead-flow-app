import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { emailAnalyticsUseCase } from "@/app/api/useCases/email/EmailAnalyticsUseCase"

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  await connection()

  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { id } = await context.params
    const { searchParams } = new URL(request.url)

    // Sem período, o funil cobre a campanha inteira — é a pergunta natural
    // ("o que esta campanha produziu?"), não "o que ela produziu nos 30 dias".
    const result = await emailAnalyticsUseCase.getCampaignFunnel({
      teamId: teamAccess.access.teamId,
      campaignId: id,
      from: parseDate(searchParams.get("from")),
      to: parseDate(searchParams.get("to")),
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCampaignFunnelRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
