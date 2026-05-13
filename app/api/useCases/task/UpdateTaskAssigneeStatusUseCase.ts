import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import { notificationService } from "@/app/api/services/notifications/NotificationService";
import type { IUpdateTaskAssigneeStatusUseCase, UpdateTaskAssigneeStatusInput } from "./IUpdateTaskAssigneeStatusUseCase";

export class UpdateTaskAssigneeStatusUseCase implements IUpdateTaskAssigneeStatusUseCase {
  async execute(input: UpdateTaskAssigneeStatusInput): Promise<Output> {
    const task = await taskRepository.findByIdWithAssignees(input.taskId);
    if (!task || task.lead.teamId !== input.teamId) {
      return new Output(false, [], ["Tarefa não encontrada ou sem permissão."], null);
    }

    const assignee = task.assignees.find((item) => item.profileId === input.assigneeProfileId);
    if (!assignee) {
      return new Output(false, [], ["Responsável não encontrado nesta tarefa."], null);
    }

    const wasGloballyDone = task.assignees.length > 0 && task.assignees.every((item) => item.status === "DONE");
    const willBeGloballyDone =
      input.status === "DONE" &&
      task.assignees.length > 0 &&
      task.assignees.every((item) =>
        item.profileId === input.assigneeProfileId ? true : item.status === "DONE"
      );

    const updated = await taskRepository.updateAssigneeStatus(
      input.taskId,
      input.assigneeProfileId,
      input.status
    );

    if (input.status === "DONE" && assignee.status !== "DONE") {
      await taskRepository.createTaskStatusActivity({
        leadId: task.leadId,
        actorProfileId: input.requestingProfileId,
        taskId: task.id,
        taskTitle: task.title,
        status: input.status,
      });

      if (!wasGloballyDone && willBeGloballyDone && task.createdBy !== input.requestingProfileId) {
        const lead = await taskRepository.findLeadInTeam(task.leadId, input.teamId);
        const actor = await taskRepository.findCreatorProfile(input.requestingProfileId);
        if (lead) {
          try {
            await notificationService.createTaskCompletedNotification({
              teamId: input.teamId,
              actorProfileId: input.requestingProfileId,
              actorName: actor?.fullName || actor?.email || "Usuário",
              recipientProfileId: task.createdBy,
              leadId: lead.id,
              leadCode: lead.leadCode ?? null,
              leadName: lead.name,
              taskId: task.id,
              taskTitle: task.title,
            });
          } catch (notificationError) {
            console.error("[UpdateTaskAssigneeStatusUseCase] Erro ao criar notificação de task concluída:", notificationError);
          }
        }
      }
    }

    return new Output(true, ["Status atualizado com sucesso"], [], updated);
  }
}

export const updateTaskAssigneeStatusUseCase = new UpdateTaskAssigneeStatusUseCase();
