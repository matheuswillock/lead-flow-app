import { NextResponse, type NextRequest, connection } from "next/server";
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { backofficeCnaeUseCase } from "@/app/api/useCases/backofficeLeadExtraction/BackofficeCnaeUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  await connection();

  try {
    const access = await getBackofficeAccess(request)
    if (access.error) {
      return NextResponse.json(access.error, { status: access.status })
    }

    const q = new URL(request.url).searchParams.get("q") ?? undefined
    const result = await backofficeCnaeUseCase.list(q)

    return NextResponse.json(result.result, { status: 200 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeCnaesRoute][GET]", error)
    return NextResponse.json({ message: "Erro ao buscar CNAEs" }, { status: 500 })
  }
}
