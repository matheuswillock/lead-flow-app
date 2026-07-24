import { type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  parsePositiveInt,
  resolveStudioEmailActor,
  studioEmailError,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

const addSchema = z.object({
  email: z.string().email("E-mail inválido"),
  name: z.string().nullable().optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams & { listId: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all), {
      requireManager: false,
    })
    if (resolved.error) return resolved.error
    const { searchParams } = new URL(request.url)
    const output = await backofficeStudioEmailUseCase.listContacts(resolved.actor, all.listId, {
      page: parsePositiveInt(searchParams.get("page"), 1),
      pageSize: Math.min(parsePositiveInt(searchParams.get("pageSize"), 20), 100),
      search: searchParams.get("search") ?? undefined,
    })
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailContactsRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all))
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = addSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }
    const output = await backofficeStudioEmailUseCase.addContact(
      resolved.actor,
      all.listId,
      validation.data.email,
      validation.data.name ?? null
    )
    return studioEmailJson(output, 201)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailContactsRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
