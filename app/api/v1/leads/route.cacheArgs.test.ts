import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest, NextResponse, after } from "next/server";
import { Output } from "@/lib/output";

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  after,
  connection: mock(async () => undefined),
}));

mock.module("server-only", () => ({}));

type Access = {
  teamId: string;
  profileId: string;
  supabaseId: string;
  profileEmail: string | null;
  teamMember: { role: string; functions: string[] };
};

let currentAccess: Access;

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: mock(async () => ({ access: currentAccess })),
}));

const getCachedTeamLeadsMock = mock(async (_args: Record<string, unknown>) => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { leads: [], total: 0 },
}));

// O predicado de bypass NÃO é mockado: vive em módulo próprio e sem
// dependências, então a rota exercita a lógica real de roteamento.
mock.module("@/app/api/useCases/leads/getCachedTeamLeads", () => ({
  getCachedTeamLeads: getCachedTeamLeadsMock,
  // A rota faz `instanceof` nesta classe para distinguir falha de listagem de
  // erro inesperado, entao o mock precisa expor o mesmo simbolo.
  CachedTeamLeadsUnavailableError: class CachedTeamLeadsUnavailableError extends Error {
    constructor(readonly errorMessages: string[]) {
      super(errorMessages[0] ?? "Erro interno do servidor");
      this.name = "CachedTeamLeadsUnavailableError";
    }
  },
}));

const getAllLeadsByUserRoleWithCtxMock = mock(
  async () => new Output(true, [], [], { leads: [], total: 0 })
);

mock.module("@/app/api/useCases/leads/leadUseCaseInstance", () => ({
  leadUseCase: {
    getAllLeadsByUserRoleWithCtx: getAllLeadsByUserRoleWithCtxMock,
    createLead: mock(async () => new Output(true, [], [], { id: "lead-1" })),
    enrichLeadRazaoSocial: mock(async () => undefined),
  },
}));

mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: mock(() => undefined),
}));

const { GET } = await import("./route");

function boardRequest(extraParams = "") {
  return new NextRequest(`http://localhost/api/v1/leads?role=manager${extraParams}`, {
    method: "GET",
  });
}

function grantManager(profileId: string, email: string) {
  currentAccess = {
    teamId: "team-1",
    profileId,
    supabaseId: `sup-${profileId}`,
    profileEmail: email,
    teamMember: { role: "manager", functions: [] },
  };
}

beforeEach(() => {
  getCachedTeamLeadsMock.mockClear();
  getAllLeadsByUserRoleWithCtxMock.mockClear();
});

describe("ganho cross-user do cache", () => {
  it("dois managers distintos do mesmo time geram argumentos idênticos", async () => {
    grantManager("profile-alice", "alice@x.com");
    await GET(boardRequest());
    const alice = getCachedTeamLeadsMock.mock.calls[0]?.[0];

    getCachedTeamLeadsMock.mockClear();

    grantManager("profile-bob", "bob@x.com");
    await GET(boardRequest());
    const bob = getCachedTeamLeadsMock.mock.calls[0]?.[0];

    // Este é o teste que prova o ganho: se os argumentos divergissem, cada
    // manager teria a própria entrada de cache e o board não colapsaria.
    expect(JSON.stringify(alice)).toBe(JSON.stringify(bob));
  });

  it("manager-like usa scopeProfileId vazio", async () => {
    grantManager("profile-alice", "alice@x.com");
    await GET(boardRequest());

    expect(getCachedTeamLeadsMock.mock.calls[0]?.[0]).toMatchObject({ scopeProfileId: "" });
  });

  it("operator mantém o próprio perfil no escopo", async () => {
    currentAccess = {
      teamId: "team-1",
      profileId: "profile-op",
      supabaseId: "sup-op",
      profileEmail: "op@x.com",
      teamMember: { role: "operator", functions: ["SDR"] },
    };

    await GET(new NextRequest("http://localhost/api/v1/leads?role=operator", { method: "GET" }));

    expect(getCachedTeamLeadsMock.mock.calls[0]?.[0]).toMatchObject({
      scopeProfileId: "profile-op",
    });
  });

  it("o papel vem do TeamAccess, não do ?role= da query", async () => {
    grantManager("profile-alice", "alice@x.com");

    await GET(
      new NextRequest("http://localhost/api/v1/leads?role=operator", { method: "GET" })
    );

    expect(getCachedTeamLeadsMock.mock.calls[0]?.[0]).toMatchObject({
      role: "manager",
      scopeProfileId: "",
    });
  });
});

describe("roteamento entre cache e bypass", () => {
  it("board sem filtros vai para o cache", async () => {
    grantManager("profile-alice", "alice@x.com");
    await GET(boardRequest());

    expect(getCachedTeamLeadsMock).toHaveBeenCalled();
    expect(getAllLeadsByUserRoleWithCtxMock).not.toHaveBeenCalled();
  });

  it("busca livre faz bypass", async () => {
    grantManager("profile-alice", "alice@x.com");
    await GET(boardRequest("&search=joao"));

    expect(getCachedTeamLeadsMock).not.toHaveBeenCalled();
    expect(getAllLeadsByUserRoleWithCtxMock).toHaveBeenCalled();
  });

  it("limit definido faz bypass", async () => {
    grantManager("profile-alice", "alice@x.com");
    await GET(boardRequest("&limit=10"));

    expect(getCachedTeamLeadsMock).not.toHaveBeenCalled();
    expect(getAllLeadsByUserRoleWithCtxMock).toHaveBeenCalled();
  });

  it("intervalo de datas faz bypass", async () => {
    grantManager("profile-alice", "alice@x.com");
    await GET(boardRequest("&startDate=2026-08-01T00:00:00.000Z"));

    expect(getCachedTeamLeadsMock).not.toHaveBeenCalled();
    expect(getAllLeadsByUserRoleWithCtxMock).toHaveBeenCalled();
  });

  it("janela de calendário permanece cacheável", async () => {
    grantManager("profile-alice", "alice@x.com");
    await GET(
      boardRequest(
        "&calendarWindowStart=2026-08-01T00:00:00.000Z&calendarWindowEnd=2026-08-31T00:00:00.000Z"
      )
    );

    expect(getCachedTeamLeadsMock.mock.calls[0]?.[0]).toMatchObject({
      calendarWindowStartISO: "2026-08-01T00:00:00.000Z",
      calendarWindowEndISO: "2026-08-31T00:00:00.000Z",
    });
  });
});
