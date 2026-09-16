import type { Prisma } from "@prisma/client";
import type { TeamScopeVisibility } from "@/lib/teams/teamScopeVisibility";

/**
 * Traduz a visibilidade por time no filtro Prisma de `Task`.
 *
 * `Task` nao tem `teamId` proprio (`corretor_studio_tasks`): o escopo entra por
 * `lead.teamId`, pela relacao ja existente. Uma unica query com `IN` cobre os N
 * times — nunca uma query por time.
 *
 * A partilha e o contrato: nos times onde o perfil e manager-like, todo
 * agendamento do time entra; nos demais, so os que ele criou ou nos quais e
 * participante. Colapsar os dois ramos numa restricao global mostra demais num
 * time e de menos no outro.
 */
export function buildTaskTeamScopeWhere(
  visibility: TeamScopeVisibility,
): Prisma.TaskWhereInput {
  const scopeBranches: Prisma.TaskWhereInput[] = [];

  if (visibility.fullVisibilityTeamIds.length > 0) {
    scopeBranches.push({ lead: { teamId: { in: visibility.fullVisibilityTeamIds } } });
  }

  if (visibility.ownOnlyTeamIds.length > 0) {
    scopeBranches.push({
      lead: { teamId: { in: visibility.ownOnlyTeamIds } },
      OR: [
        { createdBy: visibility.ownerProfileId },
        { assignees: { some: { profileId: visibility.ownerProfileId } } },
      ],
    });
  }

  return { OR: scopeBranches };
}
