import { type NextRequest } from "next/server"
import { z } from "zod"
import { Output } from "@/lib/output"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { backofficeStudioEmailUseCase } from "@/app/api/useCases/backofficeStudioEmail/BackofficeStudioEmailUseCase"
import {
  resolveStudioEmailActor,
  studioEmailJson,
  type StudioEmailRouteParams,
} from "@/app/api/v1/backoffice/utils/studioEmailRoute"

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  templateId: z.string().uuid().optional(),
  contactListId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams & { campaignId: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const all = await params
    const resolved = await resolveStudioEmailActor(request, Promise.resolve(all), {
      requireManager: false,
    })
    if (resolved.error) return resolved.error

    const output = await backofficeStudioEmailUseCase.getCampaign(resolved.actor, all.campaignId)
    return studioEmailJson(output, output.isValid ? 200 : 404)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailCampaignByIdRoute][GET]", error)
    return studioEmailJson(new Output(false, [], ["Erro interno"], null), 500)
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

    const output = await backofficeStudioEmailUseCase.updateCampaign(
      resolved.actor,
      all.campaignId,
      validation.data
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailCampaignByIdRoute][PATCH]", error)
    return studioEmailJson(new Output(false, [], ["Erro interno"], null), 500)
  }
}
