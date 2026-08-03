import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeLeadExtractionUseCase } from "@/app/api/useCases/backofficeLeadExtraction/BackofficeLeadExtractionUseCase"
import type { LeadExtractionFilters } from "@/app/api/useCases/backofficeLeadExtraction/BackofficeLeadExtractionUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? 1))
    const pageSize = Math.max(5, Number(searchParams.get("pageSize") ?? 10))

    const output = await backofficeLeadExtractionUseCase.listHistory(
      result.access.profileId,
      page,
      pageSize
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeLeadExtractionRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }

    const body = await request.json()
    const filters: LeadExtractionFilters = {
      mainCnae: body.mainCnae,
      sideCnae: body.sideCnae,
      state: body.state,
      municipalityCode: body.municipalityCode ? Number(body.municipalityCode) : undefined,
      statusId: body.statusId,
      natureId: body.natureId,
      sizeId: body.sizeId,
      simplesOptant: body.simplesOptant,
      simeiOptant: body.simeiOptant,
      foundedGte: body.foundedGte,
      foundedLte: body.foundedLte,
      hasPhone: body.hasPhone,
      hasEmail: body.hasEmail,
    }

    const output = await backofficeLeadExtractionUseCase.search(
      result.access.profileId,
      filters,
      body.limit
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeLeadExtractionRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
