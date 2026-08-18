import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeLeadExtractionUseCase } from "@/app/api/useCases/backofficeLeadExtraction/BackofficeLeadExtractionUseCase"
import type { LeadExtractionFilters } from "@/app/api/useCases/backofficeLeadExtraction/BackofficeLeadExtractionUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection();

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

    const body = await request.json() as Record<string, unknown>
    const municipalityCodes = parseMunicipalityCodes(body)
    const filters: LeadExtractionFilters = {
      mainCnae: typeof body.mainCnae === "string" ? body.mainCnae : undefined,
      states: Array.isArray(body.states)
        ? body.states.filter((state): state is string => typeof state === "string")
        : typeof body.state === "string"
          ? [body.state]
          : undefined,
      municipalityCodes,
      natureIds: Array.isArray(body.natureIds)
        ? body.natureIds.filter((id): id is string => typeof id === "string")
        : undefined,
      sizeIds: Array.isArray(body.sizeIds)
        ? body.sizeIds.filter((id): id is string => typeof id === "string")
        : undefined,
      simplesOptant: typeof body.simplesOptant === "boolean" ? body.simplesOptant : undefined,
      simeiOptant: typeof body.simeiOptant === "boolean" ? body.simeiOptant : undefined,
      foundedGte: typeof body.foundedGte === "string" ? body.foundedGte : undefined,
      foundedLte: typeof body.foundedLte === "string" ? body.foundedLte : undefined,
      hasPhone: body.hasPhone === true ? true : undefined,
      hasEmail: body.hasEmail === true ? true : undefined,
      removeContadores: body.removeContadores === true,
    }

    const output = await backofficeLeadExtractionUseCase.search(
      result.access.profileId,
      filters,
      typeof body.limit === "number" || typeof body.limit === "string"
        ? Number(body.limit)
        : undefined
    )
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeLeadExtractionRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

function parseMunicipalityCodes(body: Record<string, unknown>): number[] | undefined {
  const rawCodes = Array.isArray(body.municipalityCodes)
    ? body.municipalityCodes
    : body.municipalityCode != null
      ? [body.municipalityCode]
      : []

  const codes = rawCodes
    .map((code) => Number(code))
    .filter((code) => Number.isInteger(code) && code > 0)

  return codes.length > 0 ? codes : undefined
}
