import { describe, expect, it, mock } from "bun:test";
import type { ILeadRepository } from "@/app/api/infra/data/repositories/lead/ILeadRepository";
import type { IProfileUseCase } from "../profiles/IProfileUseCase";
import type { TeamAccess } from "@/app/api/v1/utils/teamAccess";

mock.module("server-only", () => ({}));

// Import dinâmico depois do mock: com `import` estático o ESM iça a resolução
// acima do mock.module e o server-only volta a lançar.
const { LeadUseCase } = await import("./LeadUseCase");

/**
 * `getCachedTeamLeads` reconstrói o TeamAccess a partir de três primitivos
 * (teamId, role, scopeProfileId) em vez de passar o objeto inteiro como
 * argumento de cache — o objeto completo colocaria e-mail, nome e permissões na
 * chave, fragmentando o cache por usuário.
 *
 * Este teste trava essa premissa: se alguém passar a ler outro campo do access
 * dentro do use case, o teste fica vermelho antes de o cache servir dado errado.
 */
function buildUseCase() {
  const findAllByTeamId = mock(async () => ({ leads: [], total: 0 }));
  const findAllByOperatorIdInTeam = mock(async () => ({ leads: [], total: 0 }));

  const useCase = new LeadUseCase(
    { findAllByTeamId, findAllByOperatorIdInTeam } as unknown as ILeadRepository,
    {} as IProfileUseCase
  );

  return { useCase, findAllByTeamId, findAllByOperatorIdInTeam };
}

function spyAccess(target: Partial<TeamAccess>, reads: Set<string>): TeamAccess {
  return new Proxy(target as TeamAccess, {
    get(obj, prop) {
      if (typeof prop === "string") reads.add(prop);
      const value = Reflect.get(obj, prop);

      if (prop === "teamMember" && value && typeof value === "object") {
        return new Proxy(value as Record<string, unknown>, {
          get(inner, innerProp) {
            if (typeof innerProp === "string") reads.add(`teamMember.${innerProp}`);
            return Reflect.get(inner, innerProp);
          },
        });
      }

      return value;
    },
  });
}

describe("superfície do TeamAccess lida por getAllLeadsByUserRoleWithCtx", () => {
  it("papel manager-like lê apenas teamId e teamMember.role", async () => {
    const { useCase } = buildUseCase();
    const reads = new Set<string>();
    const access = spyAccess(
      { teamId: "team-1", profileId: "profile-1", teamMember: { role: "manager", functions: [] } },
      reads
    );

    await useCase.getAllLeadsByUserRoleWithCtx(access);

    expect(reads).toEqual(new Set(["teamId", "teamMember", "teamMember.role"]));
  });

  it("papel operator adiciona apenas profileId", async () => {
    const { useCase } = buildUseCase();
    const reads = new Set<string>();
    const access = spyAccess(
      { teamId: "team-1", profileId: "profile-1", teamMember: { role: "operator", functions: [] } },
      reads
    );

    await useCase.getAllLeadsByUserRoleWithCtx(access);

    expect(reads).toEqual(new Set(["teamId", "profileId", "teamMember", "teamMember.role"]));
  });

  it("nunca lê campos de identidade que o cache não carrega", async () => {
    const { useCase } = buildUseCase();
    const reads = new Set<string>();
    const access = spyAccess(
      { teamId: "team-1", profileId: "profile-1", teamMember: { role: "manager", functions: [] } },
      reads
    );

    await useCase.getAllLeadsByUserRoleWithCtx(access);

    for (const campo of [
      "supabaseId",
      "profileEmail",
      "profileName",
      "managerId",
      "isMaster",
      "userTimezone",
      "canViewAllTeams",
    ]) {
      expect(reads.has(campo)).toBe(false);
    }
  });

  it("manager-like consulta o time inteiro, sem escopo de perfil", async () => {
    const { useCase, findAllByTeamId, findAllByOperatorIdInTeam } = buildUseCase();

    await useCase.getAllLeadsByUserRoleWithCtx({
      teamId: "team-1",
      profileId: "profile-1",
      teamMember: { role: "manager", functions: [] },
    } as unknown as TeamAccess);

    expect(findAllByTeamId).toHaveBeenCalled();
    expect(findAllByOperatorIdInTeam).not.toHaveBeenCalled();
  });

  it("operator consulta com escopo do próprio perfil", async () => {
    const { useCase, findAllByTeamId, findAllByOperatorIdInTeam } = buildUseCase();

    await useCase.getAllLeadsByUserRoleWithCtx({
      teamId: "team-1",
      profileId: "profile-1",
      teamMember: { role: "operator", functions: [] },
    } as unknown as TeamAccess);

    expect(findAllByOperatorIdInTeam).toHaveBeenCalled();
    expect(findAllByTeamId).not.toHaveBeenCalled();
  });
});
