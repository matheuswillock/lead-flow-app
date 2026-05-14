import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";

type UpdateTaskInput = {
  taskId: string;
  teamId: string;
  title: string;
  taskType: "call" | "documentation" | "email" | "proposal" | "whatsapp" | "meeting" | "other";
  body: string;
  isUrgent: boolean;
  startAt: Date | null;
  endAt: Date | null;
  assigneeProfileIds: string[];
};

export class UpdateTaskUseCase {
  async execute(input: UpdateTaskInput): Promise<Output> {
    const task = await taskRepository.findById(input.taskId);
    if (!task || task.lead.teamId !== input.teamId) {
      return new Output(false, [], ["Tarefa não encontrada."], null);
    }

    const assignees = await taskRepository.validateTeamMembers(input.teamId, input.assigneeProfileIds);
    if (assignees.length === 0) {
      return new Output(false, [], ["Nenhum responsável pertence ao time."], null);
    }

    const updated = await taskRepository.updateTaskDetails({
      taskId: input.taskId,
      title: input.title,
      taskType: input.taskType,
      body: input.body,
      isUrgent: input.isUrgent,
      startAt: input.startAt,
      endAt: input.endAt,
      assigneeProfileIds: assignees,
    });

    return new Output(true, ["Tarefa atualizada com sucesso"], [], { task: updated });
  }
}

export const updateTaskUseCase = new UpdateTaskUseCase();

