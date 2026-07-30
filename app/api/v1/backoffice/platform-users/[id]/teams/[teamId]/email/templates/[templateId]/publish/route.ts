import { type NextRequest } from "next/server"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

type RouteContext = { params: Promise<StudioEmailRouteParams & { templateId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.publishTemplate(resolved.actor, all.templateId)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplatePublishTemplateRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.unpublishTemplate(
      resolved.actor,
      all.templateId
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplatePublishTemplateRoute][DELETE]", error)
    return studioEmailError(["Erro interno"])
  }
}
