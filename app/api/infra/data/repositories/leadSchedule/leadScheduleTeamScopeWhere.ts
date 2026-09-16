import type { Prisma } from "@prisma/client";
import type { TeamScopeVisibility } from "@/lib/teams/teamScopeVisibility";

/**
 * Traduz a visibilidade por time no filtro Prisma de `LeadsSchedule`.
 *
 * O escopo entra pelo lead (`lead.teamId`) e o "proprio agendamento" segue a
 * definicao que o widget do dashboard ja usava: lead que o perfil atende
 * (`assignedTo`) ou criou (`createdBy`).
 */
export function buildLeadScheduleTeamScopeWhere(
  visibility: TeamScopeVisibility,
): Prisma.LeadsScheduleWhereInput {
  const scopeBranches: Prisma.LeadsScheduleWhereInput[] = [];

  if (visibility.fullVisibilityTeamIds.length > 0) {
    scopeBranches.push({ lead: { teamId: { in: visibility.fullVisibilityTeamIds } } });
  }

  if (visibility.ownOnlyTeamIds.length > 0) {
    scopeBranches.push({
      lead: {
        teamId: { in: visibility.ownOnlyTeamIds },
        OR: [
          { assignedTo: visibility.ownerProfileId },
          { createdBy: visibility.ownerProfileId },
        ],
      },
    });
  }

  return { OR: scopeBranches };
}
