import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import type { IListTasksUseCase, ListTasksInput } from "./IListTasksUseCase";

export class ListTasksUseCase implements IListTasksUseCase {
  async execute(input: ListTasksInput): Promise<Output> {
    const tasks = await taskRepository.findByTeamAndDateRange({
      teamId: input.teamId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      leadId: input.leadId,
    });

    return new Output(true, [], [], tasks);
  }
}

export const listTasksUseCase = new ListTasksUseCase();
