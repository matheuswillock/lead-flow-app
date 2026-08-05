import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeSocioUseCase } from "@/app/api/useCases/backofficeLeadExtraction/BackofficeSocioUseCase"
import type { PersonSearchFilters } from "@/app/api/useCases/backofficeLeadExtraction/BackofficeSocioUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const body = await request.json()
    const filters: PersonSearchFilters = {
      names: Array.isArray(body.names) ? body.names : undefined,
      types: Array.isArray(body.types) ? body.types : undefined,
      ageRanges: Array.isArray(body.ageRanges) ? body.ageRanges : undefined,
    }

    const output = await backofficeSocioUseCase.search(filters, body.limit)
    return NextResponse.json(output, { status: output.isValid ? 200 : 422 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeSociosRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
