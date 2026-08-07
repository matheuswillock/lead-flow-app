import { type NextRequest, connection } from "next/server";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import { addDaysInTz, startOfDayInTz } from "@/lib/dates"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();

  try {
    const resolved = await resolveStudioEmailActor(request, params, { requireManager: false })
    if (resolved.error) return resolved.error
    const { searchParams } = new URL(request.url)
    const fromParam = searchParams.get("from")
    const toParam = searchParams.get("to")
    const campaignId = searchParams.get("campaignId") ?? undefined
    const tz = "America/Sao_Paulo"
    const from = fromParam ? new Date(fromParam) : startOfDayInTz(addDaysInTz(new Date(), -30, tz), tz)
    const to = toParam ? new Date(toParam) : new Date()
    const output = await backofficeStudioEmailUseCase.getAnalytics(resolved.actor, {
      from,
      to,
      campaignId,
    })
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailAnalyticsRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}
