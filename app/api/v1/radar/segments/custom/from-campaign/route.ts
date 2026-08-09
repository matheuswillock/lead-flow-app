import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { createSegmentFromCampaignUseCase } from "@/app/api/useCases/radar/CreateSegmentFromCampaignUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { invalidateRadarSegmentsCache } from "@/lib/cache/invalidation"
import { z } from "zod"
import { radarSegmentRulesSchema } from "@/lib/radar/segment-dsl"

const createFromCampaignSchema = z.object({
  campaignId: z.string().uuid("campaignId deve ser um UUID válido"),
  name: z.string().trim().min(1, "name é obrigatório").max(120, "name deve ter no máximo 120 caracteres"),
  description: z.string().trim().max(500).optional().nullable(),
  additionalRules: radarSegmentRulesSchema.optional(),
})

/**
 * POST /api/v1/radar/segments/custom/from-campaign
 * D14: Cria segmento a partir de campanha de e-mail.
 */
export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const body = await request.json().catch(() => null)
    const parsed = createFromCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        new Output(false, [], parsed.error.issues.map((issue) => issue.message), null),
        { status: 400 }
      )
    }

    const result = await createSegmentFromCampaignUseCase.execute({
      ctx: radarAccess.access,
      campaignId: parsed.data.campaignId,
      name: parsed.data.name,
      description: parsed.data.description,
      additionalRules: parsed.data.additionalRules,
    })

    if (result.isValid) {
      invalidateRadarSegmentsCache({ teamId: radarAccess.access.teamId })
    }

    return NextResponse.json(result, { status: result.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[CreateSegmentFromCampaignRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
