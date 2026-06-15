import { NextRequest, NextResponse } from "next/server";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { cancelTaskUseCase } from "@/app/api/useCases/task/CancelTaskUseCase";
import { invalidateTeamCalendarCache, invalidateTeamTasksCache } from "@/lib/cache/invalidation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { taskId } = await params;

    const result = await cancelTaskUseCase.execute({
      taskId,
      requestingProfileId: teamAccess.access.profileId,
      teamId: teamAccess.access.teamId,
    });

    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrada")) ? 404 : 403;
      return NextResponse.json(result, { status });
    }

    invalidateTeamCalendarCache({ teamId: teamAccess.access.teamId });
    invalidateTeamTasksCache({ teamId: teamAccess.access.teamId });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[TaskCancelRoute][POST] Erro:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
