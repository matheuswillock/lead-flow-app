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

/**
 * Identidade completa de um chamador, não só os três campos que o cache carrega.
 *
 * O ponto do arquivo é justamente variar tudo que NÃO deveria entrar na chave e
 * confirmar que não entra — e variar o que DEVE entrar e confirmar que separa.
 */
type Caller = {
  teamId: string;
  profileId: string;
  supabaseId: string;
  profileEmail: string | null;
  profileName: string | null;
  managerId: string;
  isMaster: boolean;
  userTimezone: string;
  canViewAllTeams: boolean;
  canCreateAccountUsers: boolean;
  canManageAccountTeams: boolean;
  canTransferAccountLeads: boolean;
  teamMember: { role: string; functions: string[] };
};

let currentAccess: Caller;

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: mock(async () => ({ access: currentAccess })),
}));

const getCachedTeamLeadsMock = mock(async (_args: Record<string, unknown>) => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { leads: [], total: 0 },
}));

mock.module("@/app/api/useCases/leads/getCachedTeamLeads", () => ({
  getCachedTeamLeads: getCachedTeamLeadsMock,
  CachedTeamLeadsUnavailableError: class CachedTeamLeadsUnavailableError extends Error {
    constructor(readonly errorMessages: string[]) {
      super(errorMessages[0] ?? "Erro interno do servidor");
      this.name = "CachedTeamLeadsUnavailableError";
    }
  },
}));

mock.module("@/app/api/useCases/leads/leadUseCaseInstance", () => ({
  leadUseCase: {
    getAllLeadsByUserRoleWithCtx: mock(async () => new Output(true, [], [], { leads: [], total: 0 })),
    createLead: mock(async () => new Output(true, [], [], { id: "lead-1" })),
    enrichLeadRazaoSocial: mock(async () => undefined),
  },
}));

mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: mock(() => undefined),
}));

const { GET } = await import("./route");

/**
 * Monta um chamador com identidade totalmente distinta. Só `teamId` e `role`
 * são parametrizados — todo o resto varia com o índice, de propósito.
 */
function caller(index: number, teamId: string, role: string): Caller {
  return {
    teamId,
    profileId: `profile-${index}`,
    supabaseId: `supabase-${index}`,
    profileEmail: `pessoa${index}@exemplo.com`,
    profileName: `Pessoa ${index}`,
    managerId: `manager-${index}`,
    isMaster: index % 2 === 0,
    userTimezone: index % 2 === 0 ? "America/Sao_Paulo" : "America/Manaus",
    canViewAllTeams: index % 2 === 0,
    canCreateAccountUsers: index % 3 === 0,
    canManageAccountTeams: index % 3 === 1,
    canTransferAccountLeads: index % 3 === 2,
    teamMember: { role, functions: index % 2 === 0 ? ["SDR"] : ["CLOSER"] },
  };
}

async function argsFor(access: Caller): Promise<string> {
  currentAccess = access;
  getCachedTeamLeadsMock.mockClear();
  await GET(new NextRequest("http://localhost/api/v1/leads?role=manager", { method: "GET" }));
  const call = getCachedTeamLeadsMock.mock.calls[0]?.[0];
  expect(call).toBeDefined();
  return JSON.stringify(call);
}

beforeEach(() => {
  getCachedTeamLeadsMock.mockClear();
});

describe("colapso — o que PRECISA compartilhar entrada", () => {
  it("oito managers com identidades totalmente distintas do mesmo time colapsam", async () => {
    // Mais forte que comparar dois managers fixos: aqui variam profileId,
    // supabaseId, e-mail, nome, managerId, isMaster, timezone, as quatro
    // permissões e as functions. Se QUALQUER um desses vazasse para a chave, o
    // cache fragmentaria por usuário e o ganho do PR #970 seria zero.
    const chaves = new Set<string>();
    for (let i = 0; i < 8; i++) {
      chaves.add(await argsFor(caller(i, "team-alpha", "manager")));
    }

    expect(chaves.size).toBe(1);
  });

  it("todo papel manager-like zera o scopeProfileId", async () => {
    // `manager` e `backoffice` são os dois papéis que `isManagerLikeRole`
    // reconhece (lib/roles.ts:7). Ambos enxergam o time inteiro, então nenhum
    // dos dois carrega perfil no escopo.
    for (const [i, role] of ["manager", "backoffice"].entries()) {
      const chave = JSON.parse(await argsFor(caller(i, "team-alpha", role)));
      expect(chave.scopeProfileId).toBe("");
    }
  });

  it("REGISTRA: papéis manager-like diferentes ainda ocupam entradas separadas", async () => {
    // Comportamento atual, e o teste existe para documentá-lo, não para
    // aprová-lo. `role` entra cru na chave, então `manager` e `backoffice`
    // geram DUAS entradas para uma consulta que é byte a byte a mesma —
    // `getAllLeadsByUserRoleWithCtx` ramifica em `isManagerLikeRole` e chama
    // `findAllByTeamId` nos dois casos.
    //
    // É conservador e correto, mas deixa ganho na mesa: num time com manager e
    // backoffice ativos, cada um paga o próprio miss. Normalizar a chave para
    // um valor único quando `isManagerLikeRole(role)` colapsaria as duas.
    //
    // Se alguém fizer essa mudança, este teste fica vermelho de propósito —
    // aí é só inverter a asserção.
    const manager = await argsFor(caller(1, "team-alpha", "manager"));
    const backoffice = await argsFor(caller(1, "team-alpha", "backoffice"));

    expect(manager).not.toBe(backoffice);
  });
});

describe("isolamento — o que NAO pode compartilhar entrada", () => {
  it("managers de times diferentes NAO colapsam", async () => {
    // Este é o teste de vazamento. Colapsar demais é pior que fragmentar: dois
    // times na mesma entrada significa um manager lendo os leads do outro.
    const alpha = await argsFor(caller(1, "team-alpha", "manager"));
    const beta = await argsFor(caller(1, "team-beta", "manager"));

    expect(alpha).not.toBe(beta);
    expect(JSON.parse(alpha).teamId).toBe("team-alpha");
    expect(JSON.parse(beta).teamId).toBe("team-beta");
  });

  it("dois operators do mesmo time NAO colapsam", async () => {
    // Operator enxerga só os próprios leads — compartilhar entrada mostraria os
    // leads de um colega.
    const um = await argsFor(caller(1, "team-alpha", "operator"));
    const outro = await argsFor(caller(2, "team-alpha", "operator"));

    expect(um).not.toBe(outro);
    expect(JSON.parse(um).scopeProfileId).toBe("profile-1");
    expect(JSON.parse(outro).scopeProfileId).toBe("profile-2");
  });

  it("manager e operator do mesmo time NAO colapsam", async () => {
    const manager = await argsFor(caller(1, "team-alpha", "manager"));
    const operator = await argsFor(caller(1, "team-alpha", "operator"));

    expect(manager).not.toBe(operator);
  });
});

describe("superfície da chave", () => {
  it("a chave carrega exatamente os dez campos previstos", async () => {
    // Trava a forma do argumento. Um campo novo entra aqui de propósito ou não
    // entra — acrescentar algo derivado de identidade sem notar é justamente
    // como o cache passaria a fragmentar em silêncio.
    currentAccess = caller(1, "team-alpha", "manager");
    await GET(new NextRequest("http://localhost/api/v1/leads?role=manager", { method: "GET" }));

    const chaves = Object.keys(getCachedTeamLeadsMock.mock.calls[0]?.[0] ?? {}).sort();

    expect(chaves).toEqual([
      "assignedTo",
      "calendarWindowEndISO",
      "calendarWindowStartISO",
      "customFieldFiltersJSON",
      "customFieldSortJSON",
      "onlyTransfer",
      "role",
      "scopeProfileId",
      "status",
      "teamId",
    ]);
  });

  it("nenhum valor da chave contem dado de identidade do manager", async () => {
    currentAccess = caller(7, "team-alpha", "manager");
    await GET(new NextRequest("http://localhost/api/v1/leads?role=manager", { method: "GET" }));

    const serializado = JSON.stringify(getCachedTeamLeadsMock.mock.calls[0]?.[0]);

    for (const segredo of [
      "profile-7",
      "supabase-7",
      "pessoa7@exemplo.com",
      "Pessoa 7",
      "manager-7",
      "America/Manaus",
    ]) {
      expect(serializado).not.toContain(segredo);
    }
  });
});
