import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { getTeamAccess, hasDelegatedUserCreationAccess } from "@/app/api/v1/utils/teamAccess"
import { isManagerLikeRole } from "@/lib/roles"

export type ManagerAccessContext = {
  teamId: string
  /** Master da conta. */
  accountMasterId: string
  requesterProfileId: string
}

/**
 * Quem pede é ele mesmo, está no time ativo e é master ou manager. Base das rotas de acesso dos
 * usuários (resumo, histórico e reenvio). Devolve o contexto ou a resposta de erro.
 */
export async function resolveManagerAccessContext(
  request: NextRequest,
  supabaseId: string,
  options: {
    /** Ações que mexem em usuários (ex.: reenviar acesso) exigem master ou manager com delegação. */
    requireUserManagement?: boolean
  } = {}
): Promise<{ context: ManagerAccessContext } | { response: NextResponse }> {
  const requesterId = request.headers.get("x-supabase-user-id")
  if (!requesterId) {
    return { response: NextResponse.json(new Output(false, [], ["Header x-supabase-user-id é obrigatório"], null), { status: 401 }) }
  }
  if (requesterId !== supabaseId) {
    return { response: NextResponse.json(new Output(false, [], ["Você só pode gerenciar seus próprios recursos"], null), { status: 403 }) }
  }

  const teamAccess = await getTeamAccess(request)
  if ("error" in teamAccess) {
    return { response: NextResponse.json(teamAccess.error, { status: teamAccess.status }) }
  }
  const { teamId, teamMember, managerId, profileId } = teamAccess.access
  if (!isManagerLikeRole(teamMember.role)) {
    return {
      response: NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager pode ver ou reenviar o acesso de usuários"], null),
        { status: 403 }
      ),
    }
  }
  if (options.requireUserManagement && !hasDelegatedUserCreationAccess(teamAccess.access)) {
    return {
      response: NextResponse.json(
        new Output(false, [], ["Apenas o master ou um manager delegado pode gerenciar os usuários da conta"], null),
        { status: 403 }
      ),
    }
  }
  return { context: { teamId, accountMasterId: managerId, requesterProfileId: profileId } }
}
