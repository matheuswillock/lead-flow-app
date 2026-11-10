import { NextRequest, NextResponse } from "next/server"
import { Output } from "@/lib/output"
import { isManagerLikeRole } from "@/lib/roles"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { LEAD_NOT_FOUND } from "@/app/api/useCases/leadAdministratorInterview/LeadAdministratorInterviewUseCase"

export type InterviewAccess = { teamId: string; profileId: string }

/** Registrar a entrevista e avisar o cliente: closer, manager ou master. */
export async function resolveInterviewWriteAccess(
  request: NextRequest,
): Promise<{ access: InterviewAccess; response?: undefined } | { response: NextResponse }> {
  const teamAccess = await getTeamAccess(request)
  if (teamAccess.error) return { response: NextResponse.json(teamAccess.error, { status: teamAccess.status }) }

  const { teamId, profileId, managerId, teamMember } = teamAccess.access
  const allowed =
    managerId === profileId ||
    isManagerLikeRole(teamMember?.role) ||
    !!teamMember?.functions?.includes("CLOSER")
  if (!allowed) {
    const output = new Output(false, [], ["Somente closer, manager ou master pode cuidar da entrevista."], null)
    return { response: NextResponse.json(output, { status: 403 }) }
  }
  return { access: { teamId, profileId } }
}

export function interviewStatusOf(output: Output) {
  if (output.isValid) return 200
  return output.errorMessages.includes(LEAD_NOT_FOUND) ? 404 : 400
}

export function interviewServerError(error: unknown, scope: string) {
  console.error(`[LeadAdministratorInterviewRoute][${scope}]`, error)
  return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 })
}
