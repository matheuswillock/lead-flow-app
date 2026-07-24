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
  rows: z.array(
    z.object({
      line: z.number().optional(),
      email: z.string().email(),
      name: z.string().optional(),
      customFields: z.record(z.string(), z.string()).optional(),
    })
  ),
})

type RouteContext = { params: Promise<StudioEmailRouteParams & { listId: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = schema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }
    const output = await backofficeStudioEmailUseCase.importMappedContacts(
      resolved.actor,
      all.listId,
      validation.data.rows
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailContactImportMappedRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
