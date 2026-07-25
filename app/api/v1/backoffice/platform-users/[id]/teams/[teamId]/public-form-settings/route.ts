import { type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { publicFormSettingsSchema } from "@/lib/public-forms/validation"
import { backofficeStudioPublicFormsUseCase } from "@/app/api/useCases/backofficeStudioPublicForms/BackofficeStudioPublicFormsUseCase"
import {
  resolveStudioPublicFormsActor,
  studioPublicFormsJson,
  type StudioPublicFormsRouteParams,
} from "@/app/api/v1/backoffice/utils/studioPublicFormsRoute"

type RouteContext = { params: Promise<StudioPublicFormsRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioPublicFormsActor(request, params, {
      requireManager: false,
    })
    if (resolved.error) return resolved.error
    const output = await backofficeStudioPublicFormsUseCase.getSettings(resolved.actor)
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormSettingsRoute][GET]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioPublicFormsActor(request, params)
    if (resolved.error) return resolved.error
    const parsed = publicFormSettingsSchema.safeParse(await request.json().catch(() => null))
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
    const output = await backofficeStudioPublicFormsUseCase.updateSettings(
      resolved.actor,
      parsed.data
    )
    return studioPublicFormsJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioPublicFormSettingsRoute][PATCH]", error)
    return studioPublicFormsJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
