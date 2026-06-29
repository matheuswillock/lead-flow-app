import { NextResponse, type NextRequest } from "next/server"
import { getCdpAccess, teamContextFromCdpAccess } from "@/app/api/v1/cdp/utils/getCdpAccess"
import { customerDataPlatformUseCase } from "@/app/api/useCases/cdp/CustomerDataPlatformUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function POST(request: NextRequest) {
  try {
    const cdpAccess = await getCdpAccess(request)
    if (cdpAccess.error) {
      return NextResponse.json(cdpAccess.error, { status: cdpAccess.status })
    }

    const result = await customerDataPlatformUseCase.syncWhatsapp(
      cdpAccess.access.teamId,
      teamContextFromCdpAccess(cdpAccess.access)
    )

    return NextResponse.json(result, { status: result.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[CdpSyncWhatsappRoute][POST]", error)
    return NextResponse.json(
      { isValid: false, successMessages: [], errorMessages: ["Erro interno"], result: null },
      { status: 500 }
    )
  }
}
