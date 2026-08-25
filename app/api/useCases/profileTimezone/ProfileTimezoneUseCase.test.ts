import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

mock.module("server-only", () => ({}));

const { ProfileTimezoneUseCase } = await import("./ProfileTimezoneUseCase");

let profiles: {
  findTimezoneBySupabaseId: ReturnType<typeof mock>;
  updateTimezoneBySupabaseId: ReturnType<typeof mock>;
};
let teams: { findTeamIdsByMaster: ReturnType<typeof mock> };

function buildUseCase() {
  return new ProfileTimezoneUseCase(profiles as never, teams as never);
}

beforeEach(() => {
  profiles = {
    findTimezoneBySupabaseId: mock(async () => ({
      id: "profile-1",
      timezone: "America/Sao_Paulo",
    })),
    updateTimezoneBySupabaseId: mock(async () => ({ id: "profile-1" })),
  };
  teams = { findTeamIdsByMaster: mock(async () => ["team-1", "team-2"]) };
});

describe("getTimezone", () => {
  it("devolve o fuso configurado", async () => {
    const output = await buildUseCase().getTimezone("sup-1");

    expect(output.isValid).toBe(true);
    expect(output.result).toEqual({ timezone: "America/Sao_Paulo" });
  });

  it("falha quando o perfil nao existe", async () => {
    profiles.findTimezoneBySupabaseId = mock(async () => null);

    const output = await buildUseCase().getTimezone("sup-inexistente");

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Perfil não encontrado"]);
  });
});

describe("updateTimezone", () => {
  it("devolve os times afetados para invalidacao do bootstrap", async () => {
    const output = await buildUseCase().updateTimezone("sup-1", "America/Fortaleza");

    expect(output.isValid).toBe(true);
    // O bootstrap do formulario publico exibe o fuso do master, entao todos os
    // times da conta precisam ser invalidados.
    expect(output.result).toEqual({
      timezone: "America/Fortaleza",
      affectedTeamIds: ["team-1", "team-2"],
    });
  });

  it("busca os times pelo id do perfil, nao pelo supabaseId", async () => {
    await buildUseCase().updateTimezone("sup-1", "America/Fortaleza");

    expect(teams.findTeamIdsByMaster).toHaveBeenCalledWith("profile-1");
  });

  it("rejeita timezone invalido sem tocar no banco", async () => {
    const output = await buildUseCase().updateTimezone("sup-1", "Marte/Olympus");

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Timezone inválido"]);
    expect(profiles.updateTimezoneBySupabaseId).not.toHaveBeenCalled();
  });

  it("rejeita timezone vazio", async () => {
    const output = await buildUseCase().updateTimezone("sup-1", "");

    expect(output.isValid).toBe(false);
    expect(profiles.updateTimezoneBySupabaseId).not.toHaveBeenCalled();
  });

  it("falha quando o perfil nao existe, sem gravar", async () => {
    profiles.findTimezoneBySupabaseId = mock(async () => null);

    const output = await buildUseCase().updateTimezone("sup-x", "America/Fortaleza");

    expect(output.isValid).toBe(false);
    expect(profiles.updateTimezoneBySupabaseId).not.toHaveBeenCalled();
  });

  it("devolve lista vazia quando o perfil nao e master de nenhum time", async () => {
    teams.findTeamIdsByMaster = mock(async () => []);

    const output = await buildUseCase().updateTimezone("sup-1", "America/Fortaleza");

    expect(output.isValid).toBe(true);
    expect((output.result as { affectedTeamIds: string[] }).affectedTeamIds).toEqual([]);
  });

  it("nao vaza erro inesperado como mensagem de dominio", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    profiles.updateTimezoneBySupabaseId = mock(async () => {
      throw new Error("deadlock");
    });

    const output = await buildUseCase().updateTimezone("sup-1", "America/Fortaleza");

    expect(output.errorMessages).toEqual(["Erro interno"]);
    consoleError.mockRestore();
  });
});
