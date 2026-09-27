import { NextResponse, type NextRequest } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { EmailDeliverabilityAnalyticsUseCase } from "@/app/api/useCases/email/EmailDeliverabilityAnalyticsUseCase"
import { Output } from "@/lib/output"

export async function GET(request: NextRequest) {
  try {
    const access = await getTeamAccess(request)
    if (access.error) return NextResponse.json(access.error, { status: access.status })
    const params = request.nextUrl.searchParams
    const requestedDays = Number(params.get("days") ?? 30)
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30
    const output = await new EmailDeliverabilityAnalyticsUseCase().get(access.access, {
      days,
      senderDomain: params.get("domain")?.trim().toLowerCase() || undefined,
      recipientProvider: params.get("provider")?.trim().toLowerCase() || undefined,
      campaignId: params.get("campaignId")?.trim() || undefined,
    })
    return NextResponse.json(output, { status: output.isValid ? 200 : 500 })
  } catch (error) {
    console.error("[EmailDeliverabilityAnalyticsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Não foi possível carregar a análise de deliverability"], null), { status: 500 })
  }
}
