import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { listCdpFieldCatalog } from "@/lib/cdp/field-catalog"
import { getCdpAccess } from "@/app/api/v1/cdp/utils/getCdpAccess"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  try {
    const cdpAccess = await getCdpAccess(request)
    if (cdpAccess.error) {
      return NextResponse.json(cdpAccess.error, { status: cdpAccess.status })
    }

    const output = new Output(true, [], [], { fields: listCdpFieldCatalog() })
    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[CdpAvailableFieldsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
