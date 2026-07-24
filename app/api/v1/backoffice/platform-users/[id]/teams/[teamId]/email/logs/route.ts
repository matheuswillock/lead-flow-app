import { type NextRequest } from "next/server"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  parsePositiveInt,
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params, { requireManager: false })
    if (resolved.error) return resolved.error
    const { searchParams } = new URL(request.url)
    const statusParams = searchParams
      .getAll("status")
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
    const output = await backofficeStudioEmailUseCase.listLogs(resolved.actor, {
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: Math.min(parsePositiveInt(searchParams.get("pageSize"), 20), 100),
      search: searchParams.get("search") ?? undefined,
      campaignId: searchParams.get("campaignId") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      statuses: Array.from(new Set(statusParams)),
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
    })
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailLogsRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}
