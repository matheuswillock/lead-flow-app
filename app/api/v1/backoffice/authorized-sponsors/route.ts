import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireMasterAccess } from "@/app/api/v1/backoffice/utils/requireMasterAccess"
import { backofficeAuthorizedSponsorUseCase } from "@/app/api/useCases/backofficeAuthorizedSponsor/BackofficeAuthorizedSponsorUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

export async function GET(request: NextRequest) {
  try {
    console.info("[BackofficeAuthorizedSponsorsRoute][GET] iniciado")
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const output = await backofficeAuthorizedSponsorUseCase.list(result.access.profileId)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeAuthorizedSponsorsRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.info("[BackofficeAuthorizedSponsorsRoute][POST] iniciado")
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireMasterAccess(result.access)
    if (denied) return denied

    const body = (await request.json()) as { profileId?: string; notes?: string | null }
    if (!body.profileId) {
      return NextResponse.json(new Output(false, [], ["Selecione um master"], null), { status: 400 })
    }

    const output = await backofficeAuthorizedSponsorUseCase.grant(
      body.profileId,
      result.access.profileId,
      body.notes
    )
    return NextResponse.json(output, { status: output.isValid ? 201 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeAuthorizedSponsorsRoute][POST]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
