import { type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioPublicFormsUseCase } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"
import {
  resolveStudioPublicFormsActor,
  studioPublicFormsJson,
  type StudioPublicFormsFormRouteParams,
} from "@/app/api/v1/backoffice/utils/studioPublicFormsRoute"

type RouteContext = { params: Promise<StudioPublicFormsFormRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();

  try {
    const resolvedParams = await params
    const resolved = await resolveStudioPublicFormsActor(
      request,
      Promise.resolve(resolvedParams),
      { requireManager: false }
    )
    if (resolved.error) return resolved.error
    const query = request.nextUrl.searchParams
    const output = await backofficeStudioPublicFormsUseCase.analytics(
      resolved.actor,
      resolvedParams.formId,
      query.get("from") ? new Date(query.get("from")!) : undefined,
      query.get("to") ? new Date(query.get("to")!) : undefined,
      query.get("publicationId") || undefined
    )
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormAnalyticsRoute][GET]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
