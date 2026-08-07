import { type NextRequest, connection } from "next/server";
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

type RouteContext = { params: Promise<StudioEmailRouteParams & { templateId: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();

  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all), { requireManager: false })
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.listTemplateVersions(resolved.actor, all.templateId)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplateVersionsRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}
