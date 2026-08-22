import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest, NextResponse, after } from "next/server";
import { Output } from "@/lib/output";
import { ACCOUNT_MASTER_BANNED_MESSAGE } from "@/lib/account/isAccountMasterBanned";

// `connection()` lanca fora de um request scope do Next — mesmo padrao usado
// nos testes de rota do radar.
mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  after,
  connection: mock(async () => undefined),
}));

mock.module("server-only", () => ({}));

type TeamAccessResult =
  | { access: Record<string, unknown>; error?: never; status?: never }
  | { access?: never; error: Output; status: number };

let teamAccessResult: TeamAccessResult;

const realRoles = await import("@/lib/roles");

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: mock(async () => teamAccessResult),
  // Helpers puros reaproveitados do modulo real: o alvo do teste e o
  // encadeamento da rota, nao a reimplementacao das regras de funcao.
  hasLeadActivityAccess: (teamMember: { role: string; functions: string[] }) =>
    realRoles.isManagerLikeRole(teamMember.role) ||
    teamMember.functions?.includes("SDR") ||
    teamMember.functions?.includes("CLOSER"),
  isManagerOrMaster: (access: { isMaster: boolean; teamMember: { role: string } }) =>
    access.isMaster || realRoles.isManagerLikeRole(access.teamMember.role),
}));

const getLeadByIdMock = mock(async () => new Output(true, [], [], { id: "lead-1" }));
const deleteLeadMock = mock(async () => new Output(true, [], [], { id: "lead-1" }));

mock.module("@/app/api/useCases/leads/leadUseCaseInstance", () => ({
  leadUseCase: {
    getLeadById: getLeadByIdMock,
    deleteLead: deleteLeadMock,
    updateLead: mock(async () => new Output(true, [], [], { id: "lead-1" })),
    enrichLeadRazaoSocial: mock(async () => undefined),
  },
}));

const authorizeMock = mock(
  async (_input: { leadId: string; teamId: string; allowTransferredFromTeam: boolean }) =>
    new Output(true, [], [], { id: "lead-1", teamId: "team-1", status: "scheduled" })
);

mock.module("@/app/api/useCases/leads/AuthorizeLeadAccessUseCase", () => ({
  authorizeLeadAccessUseCase: { execute: authorizeMock },
  LEAD_NOT_FOUND_MESSAGE: "Lead não encontrado ou sem permissão no seu time.",
}));

mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: mock(() => undefined),
  invalidateLeadFullCache: mock(() => undefined),
}));

const { GET, DELETE } = await import("./route");

function makeRequest(method: string) {
  return new NextRequest("http://localhost/api/v1/leads/lead-1", { method });
}

const params = Promise.resolve({ id: "lead-1" });

function grantAccess(teamMember: { role: string; functions: string[] }, isMaster = false) {
  teamAccessResult = {
    access: {
      supabaseId: "sup-1",
      teamId: "team-1",
      profileId: "profile-1",
      managerId: "master-1",
      isMaster,
      teamMember,
    },
  };
}

beforeEach(() => {
  getLeadByIdMock.mockClear();
  deleteLeadMock.mockClear();
  authorizeMock.mockClear();
});

describe("bypass de conta fechado", () => {
  it("GET propaga o 403 de master banido em vez de servir o lead", async () => {
    teamAccessResult = {
      error: new Output(false, [], [ACCOUNT_MASTER_BANNED_MESSAGE], null),
      status: 403,
    };

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(403);
    expect(getLeadByIdMock).not.toHaveBeenCalled();
  });

  it("DELETE propaga o 403 de assinatura inativa em vez de apagar o lead", async () => {
    teamAccessResult = {
      error: new Output(false, [], ["A assinatura desta conta está inativa."], null),
      status: 403,
    };

    const response = await DELETE(makeRequest("DELETE"), { params });

    expect(response.status).toBe(403);
    expect(deleteLeadMock).not.toHaveBeenCalled();
  });

  it("GET propaga 401 quando falta o header de usuario", async () => {
    teamAccessResult = {
      error: new Output(false, [], ["ID do usuário é obrigatório"], null),
      status: 401,
    };

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(401);
  });
});

describe("gate de funcao SDR/CLOSER", () => {
  it("nega operator sem SDR nem CLOSER", async () => {
    grantAccess({ role: "operator", functions: [] });

    const response = await GET(makeRequest("GET"), { params });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.errorMessages[0]).toContain("SDR ou Closer");
    expect(getLeadByIdMock).not.toHaveBeenCalled();
  });

  it("permite operator com CLOSER", async () => {
    grantAccess({ role: "operator", functions: ["CLOSER"] });

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(200);
    expect(getLeadByIdMock).toHaveBeenCalled();
  });

  it("permite operator com SDR", async () => {
    grantAccess({ role: "operator", functions: ["SDR"] });

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(200);
  });

  it("permite manager sem funcoes", async () => {
    grantAccess({ role: "manager", functions: [] });

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(200);
  });
});

describe("visibilidade de lead transferido", () => {
  it("GET de manager permite lead transferido do time de origem", async () => {
    grantAccess({ role: "manager", functions: [] });

    await GET(makeRequest("GET"), { params });

    expect(authorizeMock.mock.calls[0]?.[0]).toMatchObject({
      allowTransferredFromTeam: true,
    });
  });

  it("GET de operator nao permite lead de outro time", async () => {
    grantAccess({ role: "operator", functions: ["SDR"] });

    await GET(makeRequest("GET"), { params });

    expect(authorizeMock.mock.calls[0]?.[0]).toMatchObject({
      allowTransferredFromTeam: false,
    });
  });

  it("DELETE nunca permite lead de outro time", async () => {
    grantAccess({ role: "manager", functions: [] });

    await DELETE(makeRequest("DELETE"), { params });

    expect(authorizeMock.mock.calls[0]?.[0]).toMatchObject({
      allowTransferredFromTeam: false,
    });
  });
});

describe("lead nao autorizado", () => {
  it("GET responde 404 quando o use case nega", async () => {
    grantAccess({ role: "manager", functions: [] });
    authorizeMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Lead não encontrado ou sem permissão no seu time."], null)
    );

    const response = await GET(makeRequest("GET"), { params });

    expect(response.status).toBe(404);
    expect(getLeadByIdMock).not.toHaveBeenCalled();
  });
});
