import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { isManagerLikeRole } from "@/lib/roles";
import { dashboardSchedulesUseCase } from "@/app/api/useCases/dashboardSchedules/DashboardSchedulesUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  getDashboardTeamScopeFromRequest,
  resolveDashboardTeamScope,
} from "@/app/api/v1/utils/dashboardTeamScope";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const teamScope = getDashboardTeamScopeFromRequest(request);
    const scopeResult = await resolveDashboardTeamScope(teamAccess.access, teamScope);
    if ("error" in scopeResult) {
      return NextResponse.json(scopeResult.error, { status: scopeResult.status });
    }

    const { teamIds } = scopeResult;

    const output = await dashboardSchedulesUseCase.listDayAgenda({
      teamIds,
      // Papéis manager-like enxergam o time inteiro; os demais só o que atendem.
      restrictToProfileId: isManagerLikeRole(teamAccess.access.teamMember.role)
        ? null
        : teamAccess.access.profileId,
      reference: new Date(),
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("Erro ao buscar agendamentos:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
