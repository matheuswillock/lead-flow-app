import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Output } from "@/lib/output";
import { getTeamAccess } from "@/app/api/v1/utils/teamAccess";
import { updateTaskUseCase } from "@/app/api/useCases/task/UpdateTaskUseCase";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  taskType: z.enum(["call", "documentation", "email", "proposal", "whatsapp", "meeting", "other"]),
  body: z.string().min(1),
  isUrgent: z.boolean(),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  endAt: z.string().datetime({ offset: true }).optional().nullable(),
  assigneeProfileIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const teamAccess = await getTeamAccess(request);
    if (teamAccess.error) {
      return NextResponse.json(teamAccess.error, { status: teamAccess.status });
    }

    const { taskId } = await params;
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

    const result = await updateTaskUseCase.execute({
      taskId,
      teamId: teamAccess.access.teamId,
      title: validation.data.title,
      taskType: validation.data.taskType,
      body: validation.data.body,
      isUrgent: validation.data.isUrgent,
      startAt: validation.data.startAt ? new Date(validation.data.startAt) : null,
      endAt: validation.data.endAt ? new Date(validation.data.endAt) : null,
      assigneeProfileIds: validation.data.assigneeProfileIds,
    });

    if (!result.isValid) {
      const status = result.errorMessages.some((m) => m.includes("não encontrada")) ? 404 : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[TasksByIdRoute][PATCH] Erro:", error);
    return NextResponse.json(new Output(false, [], ["Erro interno do servidor"], null), { status: 500 });
  }
}

