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

const dateRe = /^\d{4}-\d{2}-\d{2}$/
const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/
const blockedDateSchema = z.union([
  z.object({ date: z.string().regex(dateRe) }),
  z.object({ from: z.string().regex(dateRe), to: z.string().regex(dateRe) }),
])

const updateSchema = z.object({
  dispatchBlockedDates: z.array(blockedDateSchema).nullable().optional(),
  dispatchTimeFrom: z.string().regex(timeRe).nullable().optional(),
  dispatchTimeTo: z.string().regex(timeRe).nullable().optional(),
  dispatchAllowedRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  templateCreateRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  templateApprovalRequired: z.boolean().optional(),
  templateApprovalRoles: z.array(z.enum(["manager", "backoffice", "operator"])).optional(),
  blockedDispatchDays: z.array(z.number().int().min(1).max(31)).nullable().optional(),
})

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  await connection();

  try {
    const resolved = await resolveStudioEmailActor(request, params, { requireManager: false })
    if (resolved.error) return resolved.error
    const output = await backofficeStudioEmailUseCase.getSettings(resolved.actor)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailSettingsRoute][GET]", error)
    return studioEmailError(["Erro interno"])
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error
    const body = await request.json().catch(() => null)
    const validation = updateSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }
    const output = await backofficeStudioEmailUseCase.updateSettings(resolved.actor, validation.data)
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailSettingsRoute][PATCH]", error)
    return studioEmailError(["Erro interno"])
  }
}
