import { NextResponse, type NextRequest } from "next/server"
import { getRadarAccess, teamContextFromRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/radar/RadarUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const body = (await request.json()) as {
      profileId?: string
      variableKeys?: string[]
    }

    if (!body.profileId) {
      return NextResponse.json(
        { isValid: false, successMessages: [], errorMessages: ["profileId é obrigatório"], result: null },
        { status: 400 }
      )
    }

    const result = await customerDataPlatformUseCase.previewInterpolation(
      radarAccess.access.teamId,
      teamContextFromRadarAccess(radarAccess.access),
      body.profileId,
      body.variableKeys ?? []
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarInterpolationPreviewRoute][POST]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
