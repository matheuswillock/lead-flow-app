import { type NextRequest } from "next/server"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

type RouteContext = {
  params: Promise<StudioEmailRouteParams & { campaignId: string; dispatchId: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all), {
      requireManager: false,
    })
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.previewDispatch(
      resolved.actor,
      all.campaignId,
      all.dispatchId
    )
    return studioEmailJson(output, 200, 404)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailDispatchPreviewRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}
