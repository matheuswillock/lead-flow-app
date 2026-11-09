import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { teamMemberAccessEmailUseCase } from "@/app/api/useCases/teamMemberAccessEmail/teamMemberAccessEmailComposition"
import { rethrowIfPrerenderInterrupted } from "@/lib/http/rethrow-if-prerender-interrupted"
import { resolveMemberAccessInput } from "../memberAccessRouteContext"

/**
 * POST /api/v1/manager/[supabaseId]/users/[userId]/access-email
 * Master ou manager reenvia o e-mail de acesso de um usuário do time ativo: primeiro acesso para
 * quem ainda não entrou, redefinição de senha para quem já entrou.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ supabaseId: string; userId: string }> }
) {
  try {
    const context = await resolveMemberAccessInput(request, params)
    if ("response" in context) return context.response
    const { output, status } = await teamMemberAccessEmailUseCase.sendAccessEmail(context.input)
    return NextResponse.json(output, { status })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error)
    console.error("[ManagerUserAccessEmailRoute][POST]", {
      message: error instanceof Error ? error.message : "unknown",
    })
    return NextResponse.json(new Output(false, [], ["Erro ao enviar o e-mail de acesso"], null), { status: 500 })
  }
}
