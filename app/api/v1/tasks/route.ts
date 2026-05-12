import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { listTasksUseCase } from "@/app/api/useCases/task/ListTasksUseCase";

export async function GET(request: NextRequest) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const leadId = searchParams.get("leadId");

    const result = await listTasksUseCase.execute({
      teamId: teamAccess.access.teamId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      leadId: leadId ?? undefined,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[TasksRoute][GET] Erro:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
