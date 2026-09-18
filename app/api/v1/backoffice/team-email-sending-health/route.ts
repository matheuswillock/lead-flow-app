import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeTeamSendingHealthUseCase } from "@/app/api/useCases/backofficeTeamSendingHealth/BackofficeTeamSendingHealthUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

/**
 * GET ?teamIds=a,b,c → saúde de envio dos times pedidos;
 * sem query → todos os times fora de `healthy`.
 */
export async function GET(request: NextRequest) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    const teamIdsParam = request.nextUrl.searchParams.get("teamIds")
    const teamIds = teamIdsParam
      ? teamIdsParam
          .split(",")
          .map((teamId) => teamId.trim())
          .filter(Boolean)
      : undefined

    const output = await backofficeTeamSendingHealthUseCase.list(teamIds)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeTeamEmailSendingHealthRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
