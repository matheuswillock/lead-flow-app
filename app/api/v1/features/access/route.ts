import { NextResponse, type NextRequest, connection } from "next/server";
import { Output } from "@/lib/output"
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess"
import { featureAccessUseCase } from "@/app/api/useCases/featureAccess/FeatureAccessUseCase"
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request)
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status })
    }

    const output = await featureAccessUseCase.execute({
      profileId: teamAccess.access.profileId,
      managerId: teamAccess.access.managerId,
      activeTeamId: teamAccess.access.teamId,
      teamContext: {
        isMaster: teamAccess.access.isMaster,
        role: teamAccess.access.teamMember.role,
        functions: teamAccess.access.teamMember.functions,
        canManageAccountTeams: teamAccess.access.canManageAccountTeams,
        canCreateAccountUsers: teamAccess.access.canCreateAccountUsers,
      },
    })

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 })
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[FeatureAccessRoute][GET]", error)
    return NextResponse.json(new Output(false, [], ["Erro interno"], null), { status: 500 })
  }
}
