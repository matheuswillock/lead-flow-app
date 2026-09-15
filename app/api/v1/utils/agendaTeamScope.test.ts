import { describe, expect, it, mock } from "bun:test";
import type { ProfileTeamMembership } from "@/app/api/infra/data/repositories/teamMembers/ITeamMembersRepository";
import type { TeamAccess } from "./teamAccess";
import type { AgendaTeamScopeDependencies } from "./agendaTeamScope";

// `teamAccess` puxa `lib/account/getAccountAccessStatus`, que importa
// "server-only" — o módulo lança fora do runtime de servidor do Next.
// Substituição total do módulo (não factory parcial) + import dinâmico, porque
// `import` estático é içado acima do `mock.module`.
mock.module("server-only", () => ({}));

const { hasLeadAccess } = await import("./teamAccess");
const { parseAgendaTeamScope, resolveAgendaTeamVisibility } = await import("./agendaTeamScope");

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_MANAGER = "aaaaaaaa-0000-4000-8000-000000000001";
const TEAM_OPERATOR = "bbbbbbbb-0000-4000-8000-000000000002";

function buildAccess(overrides: Partial<TeamAccess> = {}): TeamAccess {
  return {
    supabaseId: "supabase-user",
    teamId: TEAM_MANAGER,
    profileId: PROFILE_ID,
    profileEmail: "thuane@example.com",
    profileName: "Thuane",
    isMaster: false,
    managerId: "master-1",
    canCreateAccountUsers: false,
    canManageAccountTeams: false,
    canTransferAccountLeads: false,
    canViewAllTeams: false,
    userTimezone: "America/Sao_Paulo",
    teamMember: { role: "manager", functions: ["SDR"] },
    ...overrides,
  };
}

function buildDependencies(
  memberships: ProfileTeamMembership[],
): AgendaTeamScopeDependencies & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    listProfileMemberships: async (profileId) => {
      calls.push(profileId);
      return memberships;
    },
  };
}

describe("resolveAgendaTeamVisibility — escopo member-all", () => {
  it("particiona por papel POR TIME: manager num time, operator no outro", async () => {
    const dependencies = buildDependencies([
      { teamId: TEAM_MANAGER, role: "manager", functions: ["SDR"] },
      { teamId: TEAM_OPERATOR, role: "operator", functions: ["SDR"] },
    ]);

    const result = await resolveAgendaTeamVisibility(
      { access: buildAccess(), scope: "member-all" },
      dependencies,
    );

    expect(result.error).toBeUndefined();
    expect(result.visibility).toEqual({
      fullVisibilityTeamIds: [TEAM_MANAGER],
      ownOnlyTeamIds: [TEAM_OPERATOR],
      ownerProfileId: PROFILE_ID,
    });
  });

  it("não aplica o papel do time ATIVO aos demais times", async () => {
    // Operator no time ativo, manager no outro: o time onde ela é manager
    // precisa continuar team-wide.
    const dependencies = buildDependencies([
      { teamId: TEAM_OPERATOR, role: "operator", functions: ["SDR"] },
      { teamId: TEAM_MANAGER, role: "manager", functions: ["SDR"] },
    ]);

    const result = await resolveAgendaTeamVisibility(
      {
        access: buildAccess({
          teamId: TEAM_OPERATOR,
          teamMember: { role: "operator", functions: ["SDR"] },
        }),
        scope: "member-all",
      },
      dependencies,
    );

    expect(result.visibility?.fullVisibilityTeamIds).toEqual([TEAM_MANAGER]);
    expect(result.visibility?.ownOnlyTeamIds).toEqual([TEAM_OPERATOR]);
  });

  it("inclui times de masters diferentes sem exigir canViewAllTeams", async () => {
    const teamOtherMaster = "cccccccc-0000-4000-8000-000000000003";
    const dependencies = buildDependencies([
      { teamId: TEAM_MANAGER, role: "manager", functions: ["SDR"] },
      { teamId: teamOtherMaster, role: "manager", functions: ["SDR"] },
    ]);

    const result = await resolveAgendaTeamVisibility(
      { access: buildAccess({ canViewAllTeams: false, isMaster: false }), scope: "member-all" },
      dependencies,
    );

    expect(result.error).toBeUndefined();
    expect(result.visibility?.fullVisibilityTeamIds).toEqual([TEAM_MANAGER, teamOtherMaster]);
  });

  it("resolve as memberships numa única consulta, não uma por time", async () => {
    const dependencies = buildDependencies(
      Array.from({ length: 41 }, (_unused, index) => ({
        teamId: `team-${index}`,
        role: "manager" as const,
        functions: [],
      })),
    );

    const result = await resolveAgendaTeamVisibility(
      { access: buildAccess({ teamId: "team-0" }), scope: "member-all" },
      dependencies,
    );

    expect(dependencies.calls).toEqual([PROFILE_ID]);
    expect(result.visibility?.fullVisibilityTeamIds).toHaveLength(41);
  });

  it("descarta times onde o perfil não tem acesso a leads, sem derrubar os demais", async () => {
    const dependencies = buildDependencies([
      { teamId: TEAM_MANAGER, role: "manager", functions: [] },
      { teamId: TEAM_OPERATOR, role: "operator", functions: [] },
    ]);

    const result = await resolveAgendaTeamVisibility(
      { access: buildAccess(), scope: "member-all", isTeamEligible: hasLeadAccess },
      dependencies,
    );

    // Manager tem acesso a leads pelo papel; operator sem função SDR, não.
    expect(result.visibility?.fullVisibilityTeamIds).toEqual([TEAM_MANAGER]);
    expect(result.visibility?.ownOnlyTeamIds).toEqual([]);
  });

  it("mantém o time ativo no escopo quando o acesso é de sponsor/backoffice sem membership", async () => {
    const dependencies = buildDependencies([]);

    const result = await resolveAgendaTeamVisibility(
      {
        access: buildAccess({ teamMember: { role: "backoffice", functions: [] } }),
        scope: "member-all",
      },
      dependencies,
    );

    expect(result.visibility?.fullVisibilityTeamIds).toEqual([TEAM_MANAGER]);
  });
});

describe("resolveAgendaTeamVisibility — escopo active", () => {
  it("usa só o time ativo e não consulta as memberships", async () => {
    const dependencies = buildDependencies([
      { teamId: TEAM_OPERATOR, role: "operator", functions: ["SDR"] },
    ]);

    const result = await resolveAgendaTeamVisibility(
      { access: buildAccess(), scope: "active" },
      dependencies,
    );

    expect(dependencies.calls).toEqual([]);
    expect(result.visibility).toEqual({
      fullVisibilityTeamIds: [TEAM_MANAGER],
      ownOnlyTeamIds: [],
      ownerProfileId: PROFILE_ID,
    });
  });

  it("restringe aos próprios agendamentos quando o papel no time ativo é menor", async () => {
    const result = await resolveAgendaTeamVisibility(
      {
        access: buildAccess({
          teamId: TEAM_OPERATOR,
          teamMember: { role: "operator", functions: ["SDR"] },
        }),
        scope: "active",
      },
      buildDependencies([]),
    );

    expect(result.visibility?.fullVisibilityTeamIds).toEqual([]);
    expect(result.visibility?.ownOnlyTeamIds).toEqual([TEAM_OPERATOR]);
  });
});

describe("parseAgendaTeamScope", () => {
  it("mapeia os valores aceitos e cai no fallback do chamador", () => {
    expect(parseAgendaTeamScope("member-all", "active")).toBe("member-all");
    expect(parseAgendaTeamScope("active", "member-all")).toBe("active");
    expect(parseAgendaTeamScope("all", "active")).toBe("account-all");
    expect(parseAgendaTeamScope(null, "member-all")).toBe("member-all");
    expect(parseAgendaTeamScope("valor-desconhecido", "active")).toBe("active");
  });
});
