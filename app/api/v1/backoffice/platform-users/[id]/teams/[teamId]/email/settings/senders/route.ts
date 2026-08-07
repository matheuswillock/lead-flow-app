import { type NextRequest, connection } from "next/server";
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
  name: z.string().min(1),
  email: z.string().email(),
  replyTo: z.string().email().nullable().optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();

  try {
    const resolved = await resolveStudioEmailActor(request, params, { requireManager: false })
    if (resolved.error) return resolved.error
    return studioEmailJson(await backofficeStudioEmailUseCase.listSenders(resolved.actor))
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailSendersRoute][GET]", error)
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
      await backofficeStudioEmailUseCase.createSender(resolved.actor, validation.data),
      201
    )
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailSendersRoute][POST]", error)
    return studioEmailError(["Erro interno"])
  }
}
