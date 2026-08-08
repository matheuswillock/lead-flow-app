import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { createChildSegmentUseCase } from "@/app/api/useCases/radar/CreateChildSegmentUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { invalidateRadarSegmentsCache } from "@/lib/cache/invalidation"
import { z } from "zod"
import { radarSegmentRulesSchema } from "@/lib/radar/segment-dsl"

const createChildSegmentSchema = z.object({
  parentSegmentId: z.string().uuid("parentSegmentId deve ser um UUID válido"),
  name: z.string().trim().min(1, "name é obrigatório").max(120, "name deve ter no máximo 120 caracteres"),
  description: z.string().trim().max(500).optional().nullable(),
  childRules: radarSegmentRulesSchema,
})

/**
 * POST /api/v1/radar/segments/custom/child
 * D14: Cria segmento filho que herda condições do pai.
 */
export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const body = await request.json().catch(() => null)
    const parsed = createChildSegmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      )
    }

    const result = await createChildSegmentUseCase.execute({
      ctx: radarAccess.access,
      parentSegmentId: parsed.data.parentSegmentId,
      name: parsed.data.name,
      description: parsed.data.description,
      childRules: parsed.data.childRules,
    })

    if (result.isValid) {
      invalidateRadarSegmentsCache({ teamId: radarAccess.access.teamId })
    }

    return NextResponse.json(result, { status: result.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[CreateChildSegmentRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
