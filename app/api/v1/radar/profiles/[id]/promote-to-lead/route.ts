import { NextResponse, type NextRequest, connection } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { promoteRadarProfileToLeadUseCase } from "@/app/api/useCases/radar/PromoteRadarProfileToLeadUseCase"
import { invalidateLeadCache, invalidateRadarSegmentsCache } from "@/lib/cache/invalidation"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  await connection()

  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const { id } = await params
    const output = await promoteRadarProfileToLeadUseCase.execute({
      profileId: id,
      access: radarAccess.access,
      ctx: teamContextFromRadarAccess(radarAccess.access),
    })

    if (!output.isValid) {
      const message = output.errorMessages.join(" ")
      const status = message.includes("não encontrado")
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
