import { NextResponse, type NextRequest } from "next/server"
import { getCdpAccess, teamContextFromCdpAccess } from "@/app/api/v1/cdp/utils/getCdpAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const cdpAccess = await getCdpAccess(request)
    if (cdpAccess.error) {
      return NextResponse.json(cdpAccess.error, { status: cdpAccess.status })
    }

    const { id } = await params
    const result = await customerDataPlatformUseCase.getProfile(
      cdpAccess.access.teamId,
      teamContextFromCdpAccess(cdpAccess.access),
      id
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 404 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[CdpProfileByIdRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
