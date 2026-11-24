import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { Output } from "@/lib/output"
import { hasPlanSimulatorAccess } from "@/lib/planSimulator/access"

export type PlanSimulatorScope = { teamId: string; ownerProfileId: string }

/** Autentica, checa papel e devolve o escopo (time + dono). Resposta de erro pronta quando negado. */
export async function requirePlanSimulatorScope(
  request: NextRequest,
): Promise<{ scope: PlanSimulatorScope; error?: never } | { scope?: never; error: NextResponse }> {
  const teamAccess = await getTeamAccess(request)
  if (teamAccess.error) {
    return { error: NextResponse.json(teamAccess.error, { status: teamAccess.status }) }
  }
  const { teamId, profileId, teamMember } = teamAccess.access
  if (!hasPlanSimulatorAccess(teamMember.role, teamMember.functions)) {
    return { error: NextResponse.json(new Output(false, [], ["Acesso negado para o simulador de planos."], null), { status: 403 }) }
  }
  return { scope: { teamId, ownerProfileId: profileId } }
}
