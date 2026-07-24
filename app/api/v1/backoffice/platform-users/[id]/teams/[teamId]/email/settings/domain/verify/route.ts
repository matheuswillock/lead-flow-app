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

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.verifyDomain(resolved.actor)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailDomainVerifyRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
