import { NextResponse, type NextRequest } from "next/server"
import { Output } from "@/lib/output"
import { getBackofficeAccess } from "@/app/api/v1/backoffice/utils/getBackofficeAccess"
import { requireManagerAccess } from "@/app/api/v1/backoffice/utils/requireManagerAccess"
import { backofficeTeamSendingHealthUseCase } from "@/app/api/useCases/backofficeTeamSendingHealth/BackofficeTeamSendingHealthUseCase"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"

type RouteParams = { params: Promise<{ teamId: string }> }

/** PATCH { action: "release" | "pause" } — liberar ou forçar a trava de reputação. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await getBackofficeAccess(request)
    if (result.error) {
      return NextResponse.json(result.error, { status: result.status })
    }
    const denied = requireManagerAccess(result.access)
    if (denied) return denied

    const { teamId } = await params
    const body = (await request.json().catch(() => null)) as {
      action?: "release" | "pause"
    } | null
    if (!body?.action) {
      return NextResponse.json(
        new Output(false, [], ["Informe a ação: release ou pause"], null),
        { status: 400 }
      )
    }

    const output = await backofficeTeamSendingHealthUseCase.applyAction(teamId, body.action)
    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[BackofficeTeamEmailSendingHealthRoute][PATCH]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
