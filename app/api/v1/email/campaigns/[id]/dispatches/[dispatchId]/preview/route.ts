import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { emailAnalyticsUseCase } from "@/app/api/useCases/email/EmailAnalyticsUseCase"

type RouteContext = { params: Promise<{ id: string; dispatchId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const { id: campaignId, dispatchId } = await context.params

    const result = await emailAnalyticsUseCase.getDispatchPreview({
      teamId: teamAccess.access.teamId,
      campaignId,
      dispatchId,
    })

    return NextResponse.json(result, { status: result.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[EmailCampaignDispatchPreviewRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
