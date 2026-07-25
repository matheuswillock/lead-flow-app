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
    const output = await backofficeStudioPublicFormsUseCase.approve(
      resolved.actor,
      resolvedParams.formId
    )
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormApproveRoute][POST]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
