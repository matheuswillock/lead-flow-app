import { type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioPublicFormsUseCase } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"
import {
  resolveStudioPublicFormsActor,
  studioPublicFormsJson,
  type StudioPublicFormsRouteParams,
} from "@/app/api/v1/backoffice/utils/studioPublicFormsRoute"

type RouteContext = { params: Promise<StudioPublicFormsRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();

  try {
    const resolved = await resolveStudioPublicFormsActor(request, params, {
      requireManager: false,
    })
    if (resolved.error) return resolved.error
    const output = await backofficeStudioPublicFormsUseCase.listTemplates(resolved.actor)
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormsTemplatesRoute][GET]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
