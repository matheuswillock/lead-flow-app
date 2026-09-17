import { NextResponse, type NextRequest, connection } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { promoteRadarProfileToLeadUseCase } from "@/app/api/useCases/radar/PromoteRadarProfileToLeadUseCase"
import { invalidateLeadCache, invalidateRadarSegmentsCache } from "@/lib/cache/invalidation"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ id: string }> }

/**
 * Corpo opcional: a promoção sem confirmação continua sendo um POST sem body.
 * Body ausente ou malformado vira "sem confirmação" — nunca 400.
 */
async function readPromotionBody(request: NextRequest): Promise<{ confirmDuplicate?: boolean }> {
  try {
    const parsed = (await request.json()) as { confirmDuplicate?: unknown }
    return { confirmDuplicate: parsed?.confirmDuplicate === true }
  } catch {
    return {}
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  await connection()

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { id } = await params
    const body = await readPromotionBody(request)
    const output = await promoteRadarProfileToLeadUseCase.execute({
      profileId: id,
      access: radarAccess.access,
      ctx: teamContextFromRadarAccess(radarAccess.access),
      confirmDuplicate: body.confirmDuplicate,
    })

    if (!output.isValid) {
      const message = output.errorMessages.join(" ")
      const result = output.result as { requiresDuplicateConfirmation?: boolean } | null

      // Duplicata é fluxo, não erro de requisição: 409 com o `result` íntegro
      // (candidatos incluídos) para o frontend oferecer a confirmação.
      const status = result?.requiresDuplicateConfirmation
        ? 409
        : message.includes("não encontrado")
          ? 404
          : message.includes("já")
            ? 409
            : 400
      return NextResponse.json(output, { status })
    }

    const result = output.result as { leadId?: string } | null
    if (result?.leadId) {
      invalidateLeadCache({ leadId: result.leadId, teamId: radarAccess.access.teamId })
      invalidateRadarSegmentsCache({ teamId: radarAccess.access.teamId })
    }

    return NextResponse.json(output, { status: 201 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[RadarProfilePromoteToLeadRoute][POST]", error)
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null },
      { status: 500 }
    )
  }
}
