import { NextRequest, NextResponse } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { landingAnalyticsQueryUseCase } from "@/app/api/useCases/landingAnalytics/LandingAnalyticsQueryUseCase"
import { Output } from "@/lib/output"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamId: string }> }) {
  const access = await getTeamAccess(request)
  if (access.error) return NextResponse.json(access.error, { status: access.status })
  const { teamId } = await params
  if (teamId !== access.access.teamId) {
    return NextResponse.json(new Output(false, [], ["Acesso negado para este time"], null), { status: 403 })
  }
  const query = request.nextUrl.searchParams
  const from = new Date(query.get("from") ?? Date.now() - 7 * 24 * 60 * 60 * 1000)
  const to = new Date(query.get("to") ?? Date.now())
  const output = await landingAnalyticsQueryUseCase.execute({
    teamId,
    from,
    to,
    landingPageId: query.get("landingPageId") || undefined,
    campaignId: query.get("campaignId") || undefined,
    templateSlug: query.get("templateSlug") || undefined,
    formId: query.get("formId") || undefined,
    publicationId: query.get("publicationId") || undefined,
  })
  return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
}
