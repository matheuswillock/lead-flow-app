import { type NextRequest } from "next/server"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
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
    const output = await backofficeStudioEmailUseCase.getDomainRecords(resolved.actor)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailDomainRecordsRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}
