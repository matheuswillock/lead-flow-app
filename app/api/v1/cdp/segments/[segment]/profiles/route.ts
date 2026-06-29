import { NextResponse, type NextRequest } from "next/server"
import { getCdpAccess, teamContextFromCdpAccess } from "@/app/api/v1/cdp/utils/getCdpAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

type RouteParams = { params: Promise<{ segment: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const cdpAccess = await getCdpAccess(request)
    if (cdpAccess.error) {
      return NextResponse.json(cdpAccess.error, { status: cdpAccess.status })
    }

    const { segment } = await params
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")))

    const result = await customerDataPlatformUseCase.listSegmentProfiles(
      cdpAccess.access.teamId,
      teamContextFromCdpAccess(cdpAccess.access),
      segment,
      page,
      pageSize
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[CdpSegmentProfilesRoute][GET]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
