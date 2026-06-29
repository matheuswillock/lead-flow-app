import { NextResponse, type NextRequest } from "next/server"
import { getCdpAccess, teamContextFromCdpAccess } from "@/app/api/v1/cdp/utils/getCdpAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"

export async function POST(request: NextRequest) {
  try {
    const cdpAccess = await getCdpAccess(request)
    if (cdpAccess.error) {
      return NextResponse.json(cdpAccess.error, { status: cdpAccess.status })
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
      cdpAccess.access.teamId,
      teamContextFromCdpAccess(cdpAccess.access),
      body.profileId,
      body.variableKeys ?? []
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[CdpInterpolationPreviewRoute][POST]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
