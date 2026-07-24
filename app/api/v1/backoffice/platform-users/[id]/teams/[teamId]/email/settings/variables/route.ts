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

const schema = z.object({
  key: z.string().min(1),
  type: z.enum(["string", "number"]).optional(),
  defaultValue: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  valueSource: z.enum(["STATIC", "RADAR"]).optional(),
  radarFieldKey: z.string().nullable().optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params, { requireManager: false })
    if (resolved.error) return resolved.error
    return studioEmailJson(await backofficeStudioEmailUseCase.listVariables(resolved.actor))
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailVariablesRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = schema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }
    return studioEmailJson(
      await backofficeStudioEmailUseCase.createVariable(resolved.actor, validation.data),
      201
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailVariablesRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
