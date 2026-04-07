import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { getScheduleAttendeesUseCase } from "@/app/api/useCases/scheduleAttendees/GetScheduleAttendeesUseCase";

export type { AttendeeRole, ScheduleAttendee } from "./ScheduleAttendeesTypes";

/**
 * GET /api/v1/leads/[id]/schedule/attendees
 * Retorna a lista de participantes do agendamento mais recente do lead,
 * enriquecida com o status RSVP do Google Calendar (quando disponível)
 * e os papéis de cada participante (closer, sdr, lead, extra).
 *
 * Query params opcionais (hints do frontend para evitar re-busca do lead):
 *   closerEmail, sdrEmail, leadEmail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      const output = new Output(false, [], ["Acesso negado: função SDR necessária para visualizar leads."], null);
      return NextResponse.json(output, { status: 403 });
    }

    const { id: leadId } = await params;
    if (!leadId) {
      const output = new Output(false, [], ["ID do lead é obrigatório"], null);
      return NextResponse.json(output, { status: 400 });
    }

    const url = new URL(request.url);
    const result = await getScheduleAttendeesUseCase.execute({
      leadId,
      teamId: teamAccess.access.teamId,
      hints: {
        closerEmail: url.searchParams.get("closerEmail"),
        sdrEmail: url.searchParams.get("sdrEmail"),
        leadEmail: url.searchParams.get("leadEmail"),
      },
    });

    if (!result.isValid) {
      const status = result.errorMessages?.includes("Lead não encontrado") ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[ScheduleAttendeesRoute][GET /api/v1/leads/[id]/schedule/attendees] Erro inesperado:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
