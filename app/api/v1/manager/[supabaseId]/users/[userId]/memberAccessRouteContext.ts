import type { NextRequest, NextResponse } from "next/server"
import type { TeamMemberAccessEmailInput } from "@/app/api/useCases/teamMemberAccessEmail/TeamMemberAccessEmailUseCase"
import { resolveManagerAccessContext } from "../managerAccessContext"

/** Contexto das rotas de acesso de UM usuário (reenvio e histórico). */
export async function resolveMemberAccessInput(
  request: NextRequest,
  params: Promise<{ supabaseId: string; userId: string }>,
  options: { requireUserManagement?: boolean } = {}
): Promise<{ input: TeamMemberAccessEmailInput } | { response: NextResponse }> {
  const { supabaseId, userId } = await params
  const resolved = await resolveManagerAccessContext(request, supabaseId, options)
  if ("response" in resolved) return resolved
  return { input: { ...resolved.context, targetProfileId: userId } }
}
