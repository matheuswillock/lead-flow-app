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
  description: z.string().optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams & { listId: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all), {
      requireManager: false,
    })
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.getContactList(resolved.actor, all.listId)
    return studioEmailJson(output, 200, 404)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailContactListByIdRoute][GET]", error)
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
    const output = await backofficeStudioEmailUseCase.updateContactList(
      resolved.actor,
      all.listId,
      validation.data
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailContactListByIdRoute][PATCH]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.deleteContactList(resolved.actor, all.listId)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailContactListByIdRoute][DELETE]", error)
    return studioEmailError(["Erro interno"])
  }
}
