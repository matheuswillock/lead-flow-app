import { beforeEach, describe, expect, it, mock } from "bun:test";

mock.module("server-only", () => ({}));

const cacheTagCalls: string[] = [];

mock.module("next/cache", () => ({
  cacheTag: mock((tag: string) => {
    cacheTagCalls.push(tag);
  }),
  cacheLife: mock(() => undefined),
}));

const { Output } = await import("@/lib/output");

type CapturedCall = {
  access: {
    teamId: string;
    profileId: string;
    teamMember: { role: string };
  };
  options: Record<string, unknown>;
};

const capturado: CapturedCall[] = [];

mock.module("./leadUseCaseInstance", () => ({
  leadUseCase: {
    getAllLeadsByUserRoleWithCtx: mock(async (access: CapturedCall["access"], options: CapturedCall["options"]) => {
      capturado.push({ access, options });
      return new Output(true, [], [], { leads: [], total: 0 });
    }),
  },
}));

const { getCachedTeamLeads } = await import("./getCachedTeamLeads");

/**
 * Sentinelas únicas em TODOS os campos.
 *
 * `getCachedTeamLeads` repassa para `getCachedTeamLeadsPayload` numa chamada
 * POSICIONAL de dez parâmetros. Uma transposição ali — trocar `teamId` por
 * `scopeProfileId`, por exemplo — é invisível para qualquer teste que pare no
 * argumento da rota, e colidiria entradas de times diferentes. Valores
 * distintos por campo fazem a troca aparecer.
 */
function args(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    teamId: "sentinela-team",
    role: "operator",
    scopeProfileId: "sentinela-profile",
    status: "sentinela-status",
    assignedTo: "sentinela-assigned",
    onlyTransfer: true,
    calendarWindowStartISO: "2026-03-01T00:00:00.000Z",
    calendarWindowEndISO: "2026-03-31T00:00:00.000Z",
    customFieldFiltersJSON: '[{"campo":"a"}]',
    customFieldSortJSON: '{"campo":"b"}',
    ...overrides,
  } as Parameters<typeof getCachedTeamLeads>[0];
}

beforeEach(() => {
  capturado.length = 0;
  cacheTagCalls.length = 0;
});

describe("repasse posicional para a funcao cacheada", () => {
  it("cada sentinela chega no campo previsto, sem transposicao", async () => {
    await getCachedTeamLeads(args());

    const { access, options } = capturado[0]!;

    // Os três que definem QUEM enxerga o quê. Uma troca entre eles é o bug de
    // vazamento: teamId no lugar de profileId faria o escopo de operator virar
    // o id do time.
    expect(access.teamId).toBe("sentinela-team");
    expect(access.profileId).toBe("sentinela-profile");
    expect(access.teamMember.role).toBe("operator");

    expect(options.status).toBe("sentinela-status");
    expect(options.assignedTo).toBe("sentinela-assigned");
    expect(options.onlyTransfer).toBe(true);
    expect((options.calendarWindowStart as Date).toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect((options.calendarWindowEnd as Date).toISOString()).toBe("2026-03-31T00:00:00.000Z");
    expect(options.customFieldFilters).toEqual([{ campo: "a" }]);
    expect(options.customFieldSort).toEqual({ campo: "b" });
  });

  it("times diferentes chegam ao use case como times diferentes", async () => {
    // A asserção de isolamento que o teste de rota não consegue fazer: ela para
    // no argumento, este vai até o consumidor.
    await getCachedTeamLeads(args({ teamId: "team-alpha" }));
    await getCachedTeamLeads(args({ teamId: "team-beta" }));

    expect(capturado[0]!.access.teamId).toBe("team-alpha");
    expect(capturado[1]!.access.teamId).toBe("team-beta");
    expect(capturado[0]!.access.teamId).not.toBe(capturado[1]!.access.teamId);
  });

  it("perfis diferentes chegam ao use case como perfis diferentes", async () => {
    await getCachedTeamLeads(args({ scopeProfileId: "profile-1" }));
    await getCachedTeamLeads(args({ scopeProfileId: "profile-2" }));

    expect(capturado[0]!.access.profileId).toBe("profile-1");
    expect(capturado[1]!.access.profileId).toBe("profile-2");
  });

  it("manager-like chega com profileId vazio, sem cair no escopo de operator", async () => {
    await getCachedTeamLeads(args({ role: "manager", scopeProfileId: "" }));

    expect(capturado[0]!.access.profileId).toBe("");
    expect(capturado[0]!.access.teamMember.role).toBe("manager");
  });
});

describe("campos vazios nao viram filtro", () => {
  it("string vazia em status e assignedTo nao entra nas options", async () => {
    // O contrato da chave usa "" para ausência. Se "" virasse filtro, o board
    // sem filtro retornaria vazio.
    await getCachedTeamLeads(
      args({ status: "", assignedTo: "", onlyTransfer: false, customFieldFiltersJSON: "", customFieldSortJSON: "" })
    );

    const { options } = capturado[0]!;
    expect(options).not.toHaveProperty("status");
    expect(options).not.toHaveProperty("assignedTo");
    expect(options).not.toHaveProperty("onlyTransfer");
    expect(options).not.toHaveProperty("customFieldFilters");
    expect(options).not.toHaveProperty("customFieldSort");
  });

  it("janela de calendario so entra com as duas pontas", async () => {
    await getCachedTeamLeads(args({ calendarWindowStartISO: "", calendarWindowEndISO: "" }));

    const { options } = capturado[0]!;
    expect(options).not.toHaveProperty("calendarWindowStart");
    expect(options).not.toHaveProperty("calendarWindowEnd");
  });
});

describe("tags declaradas na fronteira do cache", () => {
  it("sem janela de calendario declara apenas a tag do board", async () => {
    await getCachedTeamLeads(args({ calendarWindowStartISO: "", calendarWindowEndISO: "" }));

    expect(cacheTagCalls).toEqual(["team-leads:sentinela-team"]);
  });

  it("com janela declara tambem a tag do calendario", async () => {
    // É esta dupla declaração que faz uma mutação de agendamento derrubar a
    // variante de calendário — comportamento medido no protocolo manual.
    await getCachedTeamLeads(args());

    expect(cacheTagCalls).toEqual([
      "team-leads:sentinela-team",
      "team-calendar:sentinela-team",
    ]);
  });

  it("a tag carrega o teamId do argumento, nao um valor fixo", async () => {
    await getCachedTeamLeads(args({ teamId: "team-beta", calendarWindowStartISO: "", calendarWindowEndISO: "" }));

    expect(cacheTagCalls).toEqual(["team-leads:team-beta"]);
  });
});
