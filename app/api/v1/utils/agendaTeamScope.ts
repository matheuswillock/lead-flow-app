import type { NextRequest } from "next/server";
import type { Output } from "@/lib/output";
import { isManagerLikeRole } from "@/lib/roles";
import {
  buildTeamScopeVisibility,
  type TeamScopeVisibility,
} from "@/lib/teams/teamScopeVisibility";
import type { ProfileTeamMembership } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository";
import { teamMembersRepository } from "@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository";
import { resolveDashboardTeamScope } from "./dashboardTeamScope";
import type { TeamAccess } from "./teamAccess";

/**
 * Escopo das superficies de agenda (Calendario e widget do Dashboard).
 *
 * - `member-all`: todos os times das PROPRIAS memberships do perfil, inclusive
 *   de masters diferentes. E a agregacao do que o usuario ja ve trocando o time
 *   ativo, entao a autoridade vem da membership e nao ha gate adicional.
 * - `active`: so o time ativo da sessao.
 * - `account-all`: escopo legado POR MASTER de `dashboardTeamScope.ts` (`all`),
 *   atras do gate `canViewAllTeams`. Preservado como estava — nao atende perfil
 *   multi-master, que foi o que originou o `member-all`.
 */
export type AgendaTeamScope = "member-all" | "active" | "account-all";

export function parseAgendaTeamScope(
  value: string | null,
  fallback: AgendaTeamScope,
): AgendaTeamScope {
  if (value === "member-all") return "member-all";
  if (value === "active") return "active";
  if (value === "all") return "account-all";
  return fallback;
}

export function getAgendaTeamScopeFromRequest(
  request: NextRequest,
  fallback: AgendaTeamScope,
): AgendaTeamScope {
  const url = new URL(request.url);
  return parseAgendaTeamScope(url.searchParams.get("teamScope"), fallback);
}

export type AgendaTeamScopeDependencies = {
  listProfileMemberships: (profileId: string) => Promise<ProfileTeamMembership[]>;
};

const defaultDependencies: AgendaTeamScopeDependencies = {
  listProfileMemberships: (profileId) =>
    teamMembersRepository.findMembershipsByProfile(profileId),
};

export type ResolvedAgendaTeamVisibility =
  | { visibility: TeamScopeVisibility; error?: never; status?: never }
  | { visibility?: never; error: Output; status: number };

export type ResolveAgendaTeamVisibilityInput = {
  access: TeamAccess;
  scope: AgendaTeamScope;
  /**
   * Elegibilidade POR TIME, avaliada com o papel e as funcoes daquele time
   * (ex.: `hasLeadAccess` no widget do Dashboard). Time inelegivel sai do
   * escopo; escopo vazio e decidido como 403 pela rota.
   */
  isTeamEligible?: (membership: ProfileTeamMembership) => boolean;
};

export async function resolveAgendaTeamVisibility(
  input: ResolveAgendaTeamVisibilityInput,
  dependencies: AgendaTeamScopeDependencies = defaultDependencies,
): Promise<ResolvedAgendaTeamVisibility> {
  const { access, scope } = input;
  const isTeamEligible = input.isTeamEligible ?? (() => true);
  const ownerProfileId = access.profileId;
  const activeMembership: ProfileTeamMembership = {
    teamId: access.teamId,
    role: access.teamMember.role,
    functions: access.teamMember.functions,
  };

  if (scope === "active") {
    return {
      visibility: buildTeamScopeVisibility({
        ownerProfileId,
        memberships: [activeMembership].filter(isTeamEligible),
      }),
    };
  }

  if (scope === "member-all") {
    const memberships = await dependencies.listProfileMemberships(ownerProfileId);
    return {
      visibility: buildTeamScopeVisibility({
        ownerProfileId,
        memberships: withActiveTeam(memberships, activeMembership).filter(isTeamEligible),
      }),
    };
  }

  // O gate do escopo por master roda depois da elegibilidade do time ativo para
  // preservar a ordem das mensagens de 403 que a rota do Dashboard ja devolvia.
  if (!isTeamEligible(activeMembership)) {
    return { visibility: buildTeamScopeVisibility({ ownerProfileId, memberships: [] }) };
  }

  const accountScope = await resolveDashboardTeamScope(access, "all");
  if ("error" in accountScope) {
    return { error: accountScope.error, status: accountScope.status };
  }

  // O escopo por master aplica UMA restricao global, derivada do papel no time
  // ativo — comportamento legado mantido intacto para nao mexer nas metricas.
  return {
    visibility: isManagerLikeRole(access.teamMember.role)
      ? {
          fullVisibilityTeamIds: accountScope.teamIds,
          ownOnlyTeamIds: [],
          ownerProfileId,
        }
      : {
          fullVisibilityTeamIds: [],
          ownOnlyTeamIds: accountScope.teamIds,
          ownerProfileId,
        },
  };
}

/**
 * Acesso de sponsor/backoffice entra num time sem linha em `TeamMember`
 * (`getTeamAccess` monta a membership na mao). Sem isto o `member-all` devolveria
 * escopo vazio justamente para quem hoje enxerga o time.
 */
function withActiveTeam(
  memberships: ProfileTeamMembership[],
  activeMembership: ProfileTeamMembership,
): ProfileTeamMembership[] {
  const hasActiveTeam = memberships.some(
    (membership) => membership.teamId === activeMembership.teamId,
  );
  return hasActiveTeam ? memberships : [activeMembership, ...memberships];
}
