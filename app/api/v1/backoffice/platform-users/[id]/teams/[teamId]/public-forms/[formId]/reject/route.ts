import { type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioPublicFormsUseCase } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"
import {
  resolveStudioPublicFormsActor,
  studioPublicFormsJson,
  type StudioPublicFormsFormRouteParams,
} from "@/app/api/v1/backoffice/utils/studioPublicFormsRoute"

type RouteContext = { params: Promise<StudioPublicFormsFormRouteParams> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params
    const resolved = await resolveStudioPublicFormsActor(request, Promise.resolve(resolvedParams))
    if (resolved.error) return resolved.error
    const body = (await request.json().catch(() => ({}))) as { comment?: string }
    const output = await backofficeStudioPublicFormsUseCase.reject(
      resolved.actor,
      resolvedParams.formId,
      body.comment ?? ""
    )
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormRejectRoute][POST]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
