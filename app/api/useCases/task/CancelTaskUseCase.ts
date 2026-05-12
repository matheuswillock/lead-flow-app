import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import { taskGoogleCalendarService } from "@/app/api/services/taskGoogleCalendar/TaskGoogleCalendarService";
import type { ICancelTaskUseCase, CancelTaskInput } from "./ICancelTaskUseCase";

export class CancelTaskUseCase implements ICancelTaskUseCase {
  async execute(input: CancelTaskInput): Promise<Output> {
    const task = await taskRepository.findByIdWithAssignees(input.taskId);
    if (!task || task.lead.teamId !== input.teamId) {
      return new Output(false, [], ["Tarefa não encontrada ou sem permissão."], null);
    }

    if (task.createdBy !== input.requestingProfileId) {
      return new Output(false, [], ["Apenas o criador da tarefa pode cancelá-la."], null);
    }

    const syncedAssignees = await taskRepository.findConnectedAssigneesForTask(input.taskId);
    await taskRepository.cancelAllAssignees(input.taskId);

    for (const assignee of syncedAssignees) {
      if (assignee.googleSynced && assignee.googleEventId) {
        await taskGoogleCalendarService.cancelEventForAssignee({
          assigneeProfileId: assignee.profileId,
          googleEventId: assignee.googleEventId,
        });
      }
    }

    return new Output(true, ["Tarefa cancelada com sucesso"], [], { taskId: input.taskId });
  }
}

export const cancelTaskUseCase = new CancelTaskUseCase();
