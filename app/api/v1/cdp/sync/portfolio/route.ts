import { NextResponse, type NextRequest } from "next/server"
import { getCdpAccess, teamContextFromCdpAccess } from "@/app/api/v1/cdp/utils/getCdpAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"
import { parseCdpSyncFilters } from "@/lib/cdp/sync-filters"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(request: NextRequest) {
  try {
    const cdpAccess = await getCdpAccess(request)
    if (cdpAccess.error) {
      return NextResponse.json(cdpAccess.error, { status: cdpAccess.status })
    }

    const body = await request.json().catch(() => ({}))
    const filters = parseCdpSyncFilters(body)

    const result = await customerDataPlatformUseCase.syncPortfolio(
      cdpAccess.access.teamId,
      teamContextFromCdpAccess(cdpAccess.access),
      filters
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    console.error("[CdpSyncPortfolioRoute][POST]", error)
    return NextResponse.json({ isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null }, { status: 500 })
  }
}
