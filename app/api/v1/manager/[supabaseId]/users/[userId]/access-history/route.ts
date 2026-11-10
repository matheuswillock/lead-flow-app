import { NextRequest, NextResponse, connection } from "next/server"
import { Output } from "@/lib/output"
import { teamMemberAccessEmailUseCase } from "@/app/api/useCases/teamMemberAccessEmail/teamMemberAccessEmailComposition"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { resolveMemberAccessInput } from "../memberAccessRouteContext"

/**
 * GET /api/v1/manager/[supabaseId]/users/[userId]/access-history
 * Último acesso e os últimos e-mails de acesso enviados ao usuário (entregue, aberto, devolvido...).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string; userId: string }> }
) {
  await connection()
  try {
    const context = await resolveMemberAccessInput(request, params)
    if ("response" in context) return context.response
    const { output, status } = await teamMemberAccessEmailUseCase.getAccessHistory(context.input)
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[ManagerUserAccessHistoryRoute][GET]", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(new Output(false, [], ["Erro ao carregar o histórico de acesso"], null), { status: 500 })
  }
}
