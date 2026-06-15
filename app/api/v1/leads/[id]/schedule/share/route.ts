import { scheduleShareUseCase } from "@/app/api/useCases/scheduleShare/ScheduleShareUseCase";
import { getTeamAccess, hasLeadAccess } from "@/app/api/v1/utils/teamAccess";
import { Output } from "@/lib/output";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }
    if (!hasLeadAccess(teamAccess.access.teamMember)) {
      return NextResponse.json(
        new Output(false, [], ["Acesso negado: função SDR necessária para compartilhar agendamentos."], null),
        { status: 403 }
      );
    }

    const { id: leadId } = await params;
    if (!leadId) {
      return NextResponse.json(new Output(false, [], ["ID do lead é obrigatório."], null), { status: 400 });
    }

    const output = await scheduleShareUseCase.createPublicShare({
      leadId,
      teamId: teamAccess.access.teamId,
    });

    return NextResponse.json(output, { status: output.isValid ? 200 : 400 });
  } catch (error) {
    console.error("[LeadScheduleShareRoute][POST]", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor."], null), { status: 500 });
  }
}
