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
    const dataset = searchParams.get("dataset") ?? ""

    const output = await backofficeCampaignAnalyticsUseCase.exportCsv({ ...query, dataset })
    if (!output.isValid) {
      return NextResponse.json(output, { status: 400 })
    }

    const { csv, filename } = output.result as { csv: string; filename: string }
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeCampaignAnalyticsExportCsvRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
