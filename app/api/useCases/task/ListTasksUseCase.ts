import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import type { IListTasksUseCase, ListTasksInput } from "./IListTasksUseCase";

async function getCachedTasks(
  teamId: string,
  dateFrom: string | null,
  dateTo: string | null,
  leadId: string | null,
) {
  "use cache";
  cacheTag(cacheTags.teamTasks(teamId));
  cacheLife({ stale: 30, revalidate: 60 });
  return taskRepository.findByTeamAndDateRange({
    teamId,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    leadId: leadId ?? undefined,
  });
}

export class ListTasksUseCase implements IListTasksUseCase {
  async execute(input: ListTasksInput): Promise<Output> {
    const tasks = await getCachedTasks(
      input.teamId,
      input.dateFrom?.toISOString() ?? null,
      input.dateTo?.toISOString() ?? null,
      input.leadId ?? null,
    );

    return new Output(true, [], [], tasks);
  }
}

export const listTasksUseCase = new ListTasksUseCase();
