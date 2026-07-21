import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeEmailAnalyticsUseCase } from "@/app/api/useCases/backofficeEmailAnalytics/BackofficeEmailAnalyticsUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

const BACKOFFICE_TIMEZONE = "America/Sao_Paulo"

function getDefaultFrom(): Date {
  return startOfDayInTz(addDaysInTz(new Date(), -30, BACKOFFICE_TIMEZONE), BACKOFFICE_TIMEZONE)
}

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const campaignId = searchParams.get("campaignId") ?? undefined

    const from = fromParam ? new Date(fromParam) : getDefaultFrom()
    const to = toParam ? new Date(toParam) : new Date()

    const output = await backofficeEmailAnalyticsUseCase.getAnalytics({ from, to, campaignId })
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeEmailCampaignAnalyticsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
