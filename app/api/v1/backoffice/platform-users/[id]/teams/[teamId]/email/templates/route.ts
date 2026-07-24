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

const createSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  subject: z.string().min(1, "Assunto é obrigatório"),
  previewText: z.string().optional(),
  mailyJson: z.unknown().optional(),
  html: z.string().optional(),
  editorMode: z.enum(["blocks", "html"]).optional(),
  variables: z.array(z.unknown()).optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params, { requireManager: false })
    if (resolved.error) return resolved.error
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope") ?? undefined
    const output = await backofficeStudioEmailUseCase.listTemplates(resolved.actor, {
      scope: scope === "campaign" ? "campaign" : "workbench",
    })
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplatesRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = createSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }
    const output = await backofficeStudioEmailUseCase.createTemplate(
      resolved.actor,
      validation.data as never
    )
    return studioEmailJson(output, 201)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailTemplatesRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
