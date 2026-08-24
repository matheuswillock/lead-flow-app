import { describe, expect, it, mock } from "bun:test";

mock.module("server-only", () => ({}));

mock.module("next/cache", () => ({
  cacheTag: mock(() => undefined),
  cacheLife: mock(() => undefined),
}));

const { Output } = await import("@/lib/output");

let listOutput: InstanceType<typeof Output>;

mock.module("./leadUseCaseInstance", () => ({
  leadUseCase: {
    getAllLeadsByUserRoleWithCtx: mock(async () => listOutput),
  },
}));

const { getCachedTeamLeads, CachedTeamLeadsUnavailableError } = await import(
  "./getCachedTeamLeads"
);

function args() {
  return {
    teamId: "team-1",
    role: "manager",
    scopeProfileId: "",
    status: "",
    assignedTo: "",
    onlyTransfer: false,
    calendarWindowStartISO: "",
    calendarWindowEndISO: "",
    customFieldFiltersJSON: "",
    customFieldSortJSON: "",
  };
}

describe("falha nao vira entrada de cache", () => {
  it("lanca quando o use case devolve Output invalido", async () => {
    // O use case engole a excecao do banco e devolve Output(false). Se a funcao
    // cacheada RETORNASSE esse payload, o Next gravaria o erro pelo TTL inteiro.
    listOutput = new Output(false, [], ["Erro interno do servidor"], null);

    await expect(getCachedTeamLeads(args())).rejects.toBeInstanceOf(
      CachedTeamLeadsUnavailableError
    );
  });

  it("preserva as mensagens de erro para o caller responder", async () => {
    listOutput = new Output(false, [], ["Erro interno do servidor"], null);

    try {
      await getCachedTeamLeads(args());
      throw new Error("deveria ter lancado");
    } catch (error) {
      expect(error).toBeInstanceOf(CachedTeamLeadsUnavailableError);
      expect((error as InstanceType<typeof CachedTeamLeadsUnavailableError>).errorMessages).toEqual([
        "Erro interno do servidor",
      ]);
    }
  });

  it("devolve o payload normalmente quando a listagem funciona", async () => {
    listOutput = new Output(true, [], [], { leads: [], total: 0 });

    const payload = await getCachedTeamLeads(args());

    expect(payload.isValid).toBe(true);
    expect(payload.result).toEqual({ leads: [], total: 0 });
  });

  it("nao lanca por lista vazia — vazio e resultado valido", async () => {
    listOutput = new Output(true, [], [], { leads: [], total: 0 });

    await expect(getCachedTeamLeads(args())).resolves.toMatchObject({ isValid: true });
  });
});
