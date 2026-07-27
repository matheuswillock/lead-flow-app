import { type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { publicFormDraftSchema } from "@/lib/public-forms/validation"
import { backofficeStudioPublicFormsUseCase } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"
import {
  resolveStudioPublicFormsActor,
  studioPublicFormsJson,
  type StudioPublicFormsFormRouteParams,
} from "@/app/api/v1/backoffice/utils/studioPublicFormsRoute"

type RouteContext = { params: Promise<StudioPublicFormsFormRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params
    const resolved = await resolveStudioPublicFormsActor(
      request,
      Promise.resolve(resolvedParams),
      { requireManager: false }
    )
    if (resolved.error) return resolved.error
    const output = await backofficeStudioPublicFormsUseCase.get(
      resolved.actor,
      resolvedParams.formId
    )
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormRoute][GET]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const resolvedParams = await params
    const resolved = await resolveStudioPublicFormsActor(request, Promise.resolve(resolvedParams))
    if (resolved.error) return resolved.error

    const parsed = publicFormDraftSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return studioPublicFormsJson(
        new Output(
          false,
          [],
          parsed.error.issues.map((issue) => issue.message),
          null
        )
      )
    }

    const output = await backofficeStudioPublicFormsUseCase.update(
      resolved.actor,
      resolvedParams.formId,
      parsed.data
    )
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormRoute][PATCH]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
