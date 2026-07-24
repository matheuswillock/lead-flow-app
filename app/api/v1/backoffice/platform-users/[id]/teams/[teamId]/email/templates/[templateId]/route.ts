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

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  subject: z.string().min(1).optional(),
  previewText: z.string().nullable().optional(),
  mailyJson: z.unknown().optional(),
  html: z.string().nullable().optional(),
  editorMode: z.enum(["blocks", "html"]).optional(),
  variables: z.array(z.unknown()).optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams & { templateId: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all), { requireManager: false })
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.getTemplate(resolved.actor, all.templateId)
    return studioEmailJson(output, 200, 404)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplateByIdRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }
    const output = await backofficeStudioEmailUseCase.updateTemplate(
      resolved.actor,
      all.templateId,
      validation.data as never
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplateByIdRoute][PATCH]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.archiveTemplate(resolved.actor, all.templateId)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplateByIdRoute][DELETE]", error)
    return studioEmailError(["Erro interno"])
  }
}
