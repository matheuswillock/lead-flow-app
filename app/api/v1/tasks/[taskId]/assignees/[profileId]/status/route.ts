import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { updateTaskAssigneeStatusUseCase } from "@/app/api/useCases/task/UpdateTaskAssigneeStatusUseCase";

const bodySchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "DONE", "CANCELED", "OVERDUE"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string; profileId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { taskId, profileId } = await params;
    const body = await request.json();
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      const output = new Output(
        false,
        [],
        validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        null
      );
      return NextResponse.json(output, { status: 400 });
    }

    const result = await updateTaskAssigneeStatusUseCase.execute({
      taskId,
      assigneeProfileId: profileId,
      requestingProfileId: teamAccess.access.profileId,
      teamId: teamAccess.access.teamId,
      status: validation.data.status,
    });

    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrado")) ? 404 : 403;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[TaskAssigneeStatusRoute][PATCH] Erro:", error);
    const output = new Output(false, [], ["Erro interno do servidor"], null);
    return NextResponse.json(output, { status: 500 });
  }
}
