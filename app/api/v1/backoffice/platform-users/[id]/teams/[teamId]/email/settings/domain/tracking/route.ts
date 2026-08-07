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

const trackingSchema = z
  .object({
    trackingSubdomain: z
      .string()
      .min(1)
      .max(63)
      .regex(
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/,
        "Use apenas letras minúsculas, números e hífen (ex.: links)"
      ),
    openTracking: z.boolean(),
    clickTracking: z.boolean(),
  })
  .refine((data) => data.openTracking || data.clickTracking, {
    message: "Habilite pelo menos abertura ou cliques",
    path: ["openTracking"],
  })

type RouteContext = { params: Promise<StudioEmailRouteParams> }

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const resolved = await resolveStudioEmailActor(request, params)
    if (resolved.error) return resolved.error

    const body = await request.json().catch(() => null)
    const validation = trackingSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
      return studioEmailJson(new Output(false, [], errors, null))
    }

    const output = await backofficeStudioEmailUseCase.configureDomainTracking(
      resolved.actor,
      validation.data
    )
    return studioEmailJson(output)
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeStudioEmailDomainTrackingRoute][PATCH]", error)
    return studioEmailError(["Erro interno"])
  }
}
