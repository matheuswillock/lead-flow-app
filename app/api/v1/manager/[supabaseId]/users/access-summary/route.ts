import { NextRequest, NextResponse, connection } from "next/server"
import { Output } from "@/lib/output"
import { teamMemberAccessEmailUseCase } from "@/app/api/useCases/teamMemberAccessEmail/teamMemberAccessEmailComposition"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { resolveManagerAccessContext } from "../managerAccessContext"

/**
 * GET /api/v1/manager/[supabaseId]/users/access-summary
 * Situação de acesso de cada usuário do time ativo, para a coluna "Acesso" da tabela.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ supabaseId: string }> }) {
  await connection()
  try {
    const { supabaseId } = await params
    const resolved = await resolveManagerAccessContext(request, supabaseId)
    if ("response" in resolved) return resolved.response
    const { output, status } = await teamMemberAccessEmailUseCase.getTeamAccessSummary(resolved.context)
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[ManagerUsersAccessSummaryRoute][GET]", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(new Output(false, [], ["Erro ao carregar a situação de acesso"], null), { status: 500 })
  }
}
