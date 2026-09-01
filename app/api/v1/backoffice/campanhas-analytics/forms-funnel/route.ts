import { NextResponse, type NextRequest, connection } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeCampaignAnalyticsUseCase } from "@/app/api/useCases/backofficeCampaignAnalytics/BackofficeCampaignAnalyticsUseCase"
import { parseCampaignAnalyticsRangeQuery } from "@/lib/backoffice-campaign-analytics/parseRangeQuery"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection()

  try {
    const accessResult = await getBackofficeAccess(request)
    if (accessResult.error) {
      return NextResponse.json(accessResult.error, { status: accessResult.status })
    }

    const { searchParams } = new URL(request.url)
    const query = parseCampaignAnalyticsRangeQuery(searchParams)

    const output = await backofficeCampaignAnalyticsUseCase.getFormsFunnel(query)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeCampaignAnalyticsFormsFunnelRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
