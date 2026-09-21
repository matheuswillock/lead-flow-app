import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { isTeamScopeVisibilityEmpty } from "@/lib/teams/teamScopeVisibility";
import { dashboardSchedulesUseCase } from "@/app/api/useCases/dashboardSchedules/DashboardSchedulesUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';
import {
  getAgendaTeamScopeFromRequest,
  resolveAgendaTeamVisibility,
} from "@/app/api/v1/utils/agendaTeamScope";

const LEAD_ACCESS_DENIED_MESSAGE =
  "Acesso negado: função SDR necessária para visualizar leads.";

export async function GET(request: NextRequest) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    // Default `member-all`: ao entrar no dashboard o usuário vê a agenda de
    // TODOS os times em que é membro, inclusive de outros masters. O acesso a
    // leads é avaliado por time — um time sem função de leads sai do escopo,
    // sem derrubar os demais.
    const scopeResult = await resolveAgendaTeamVisibility({
      access: teamAccess.access,
      scope: getAgendaTeamScopeFromRequest(request, "member-all"),
      isTeamEligible: hasLeadAccess,
    });
    if (scopeResult.error) {
      return NextResponse.json(scopeResult.error, { status: scopeResult.status });
    }
    if (isTeamScopeVisibilityEmpty(scopeResult.visibility)) {
      const output = new Output(false, [], [LEAD_ACCESS_DENIED_MESSAGE], null);
      return NextResponse.json(output, { status: 403 });
    }

    const output = await dashboardSchedulesUseCase.listDayAgenda({
      visibility: scopeResult.visibility,
      reference: new Date(),
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 500 });

  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[DashboardSchedulesRoute][GET] Erro:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
