import { type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioPublicFormsUseCase } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"
import {
  resolveStudioPublicFormsActor,
  studioPublicFormsJson,
  type StudioPublicFormsRouteParams,
} from "@/app/api/v1/backoffice/utils/studioPublicFormsRoute"

type RouteContext = {
  params: Promise<StudioPublicFormsRouteParams & { slug: string }>
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params
    const resolved = await resolveStudioPublicFormsActor(
      request,
      Promise.resolve({
        id: resolvedParams.id,
        teamId: resolvedParams.teamId,
      }),
      { requireManager: false },
    )
    if (resolved.error) return resolved.error
    const output = await backofficeStudioPublicFormsUseCase.getTemplate(
      resolved.actor,
      resolvedParams.slug,
    )
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormsTemplateBySlugRoute][GET]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
