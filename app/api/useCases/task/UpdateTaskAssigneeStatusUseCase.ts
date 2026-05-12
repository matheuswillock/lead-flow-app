import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import type { IUpdateTaskAssigneeStatusUseCase, UpdateTaskAssigneeStatusInput } from "./IUpdateTaskAssigneeStatusUseCase";

export class UpdateTaskAssigneeStatusUseCase implements IUpdateTaskAssigneeStatusUseCase {
  async execute(input: UpdateTaskAssigneeStatusInput): Promise<Output> {
    const task = await taskRepository.findById(input.taskId);
    if (!task || task.lead.teamId !== input.teamId) {
      return new Output(false, [], ["Tarefa não encontrada ou sem permissão."], null);
    }

    const assignee = await taskRepository.findAssignee(input.taskId, input.assigneeProfileId);
    if (!assignee) {
      return new Output(false, [], ["Responsável não encontrado nesta tarefa."], null);
    }

    if (assignee.profileId !== input.requestingProfileId) {
      return new Output(false, [], ["Apenas o próprio responsável pode atualizar o status."], null);
    }

    const updated = await taskRepository.updateAssigneeStatus(
      input.taskId,
      input.assigneeProfileId,
      input.status
    );

    if (input.status === "DONE") {
      await taskRepository.createTaskStatusActivity({
        leadId: task.leadId,
        actorProfileId: input.requestingProfileId,
        taskId: task.id,
        taskTitle: task.title,
        status: input.status,
      });
    }

    return new Output(true, ["Status atualizado com sucesso"], [], updated);
  }
}

export const updateTaskAssigneeStatusUseCase = new UpdateTaskAssigneeStatusUseCase();
