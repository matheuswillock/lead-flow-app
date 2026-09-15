import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/cacheTags";
import { Output } from "@/lib/output";
import { taskRepository } from "@/app/api/infra/data/repositories/task/TaskRepository";
import type { IListTasksUseCase, ListTasksInput } from "./IListTasksUseCase";

async function getCachedTasks(
  fullVisibilityTeamIds: string[],
  ownOnlyTeamIds: string[],
  ownerProfileId: string,
  dateFrom: string | null,
  dateTo: string | null,
  leadId: string | null,
) {
  "use cache";
  // Uma tag por time do escopo: mutacao de agendamento em QUALQUER um dos times
  // precisa derrubar esta entrada, senao o Calendario multi-time serve resultado
  // velho do time que acabou de mudar.
  for (const teamId of [...fullVisibilityTeamIds, ...ownOnlyTeamIds]) {
    cacheTag(cacheTags.teamTasks(teamId));
    // teamCalendar significa "tudo que a pagina de calendario renderiza". Tasks sao
    // metade disso, entao uma mutacao de agendamento tambem precisa derrubar esta entrada.
    cacheTag(cacheTags.teamCalendar(teamId));
  }
  cacheLife({ stale: 30, revalidate: 60 });
  return taskRepository.findByTeamScopeAndDateRange({
    visibility: { fullVisibilityTeamIds, ownOnlyTeamIds, ownerProfileId },
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
    leadId: leadId ?? undefined,
  });
}

export class ListTasksUseCase implements IListTasksUseCase {
  async execute(input: ListTasksInput): Promise<Output> {
    // Ordem estavel dos times: a chave do "use cache" vem dos argumentos, e a
    // mesma visibilidade em ordem diferente geraria duas entradas distintas.
    const tasks = await getCachedTasks(
      [...input.visibility.fullVisibilityTeamIds].sort(),
      [...input.visibility.ownOnlyTeamIds].sort(),
      input.visibility.ownerProfileId,
      input.dateFrom?.toISOString() ?? null,
      input.dateTo?.toISOString() ?? null,
      input.leadId ?? null,
    );

    return new Output(true, [], [], tasks);
  }
}

export const listTasksUseCase = new ListTasksUseCase();
