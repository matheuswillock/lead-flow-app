import { type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

const schema = z.object({ versionId: z.string().uuid() })

type RouteContext = { params: Promise<StudioEmailRouteParams & { templateId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = schema.safeParse(body)
    if (!validation.success) {
      return studioEmailJson(new Output(false, [], ["versionId inválido"], null))
    }
    const output = await backofficeStudioEmailUseCase.restoreTemplateVersion(
      resolved.actor,
      all.templateId,
      validation.data.versionId
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplateRestoreRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
