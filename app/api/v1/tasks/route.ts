import { NextRequest, NextResponse, connection } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import {
  getAgendaTeamScopeFromRequest,
  resolveAgendaTeamVisibility,
} from "@/app/api/v1/utils/agendaTeamScope";
import { listTasksUseCase } from "@/app/api/useCases/task/ListTasksUseCase";
import { rethrowIfPrerenderInterrupted } from '@/lib/http/rethrow-if-prerender-interrupted';

export async function GET(request: NextRequest) {
  await connection();

  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const leadId = searchParams.get("leadId");

    // Default `active` preserva o contrato de quem consulta os agendamentos de
    // um lead do time da sessao; o Calendario pede `member-all` explicitamente.
    // Em ambos os escopos a restricao de papel e aplicada no servidor — antes
    // ela so existia como filtro de cliente no CalendarContainer.
    const scopeResult = await resolveAgendaTeamVisibility({
      access: teamAccess.access,
      scope: getAgendaTeamScopeFromRequest(request, "active"),
    });
    if (scopeResult.error) {
      return NextResponse.json(scopeResult.error, { status: scopeResult.status });
    }

    const result = await listTasksUseCase.execute({
      visibility: scopeResult.visibility,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      leadId: leadId ?? undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    rethrowIfPrerenderInterrupted(error);
    console.error("[TasksRoute][GET] Erro:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
