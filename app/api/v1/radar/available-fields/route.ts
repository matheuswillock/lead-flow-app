import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { listRadarFieldCatalog } from "@/lib/radar/field-catalog"
import { getRadarAccess } from "@/app/api/v1/radar/utils/getRadarAccess"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  try {
    const radarAccess = await getRadarAccess(request)
    if (radarAccess.error) {
      return NextResponse.json(radarAccess.error, { status: radarAccess.status })
    }

    const output = new Output(true, [], [], { fields: listRadarFieldCatalog() })
    return NextResponse.json(output, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[RadarAvailableFieldsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
