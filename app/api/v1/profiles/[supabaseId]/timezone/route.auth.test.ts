import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest, NextResponse, connection } from "next/server";

mock.module("next/server", () => ({
  NextRequest,
  NextResponse,
  connection: mock(async () => undefined),
}));
mock.module("server-only", () => ({}));

// Sem header de identidade o assertProfileOwnership tenta a sessao do Supabase,
// que le cookies() — indisponivel fora de request scope no bun test.
mock.module("@/lib/supabase/server", () => ({
  createSupabaseServer: mock(async () => null),
}));

const getTimezoneMock = mock(async (_supabaseId: string) => ({
  isValid: true,
  successMessages: [],
  errorMessages: [] as string[],
  result: { timezone: "America/Sao_Paulo" },
}));

const updateTimezoneMock = mock(async (_supabaseId: string, _tz: string) => ({
  isValid: true,
  successMessages: ["Fuso horário atualizado"],
  errorMessages: [] as string[],
  result: { timezone: "America/Fortaleza", affectedTeamIds: ["team-1"] },
}));

mock.module("@/app/api/useCases/profileTimezone/ProfileTimezoneUseCase", () => ({
  profileTimezoneUseCase: {
    getTimezone: getTimezoneMock,
    updateTimezone: updateTimezoneMock,
  },
}));

const invalidateMock = mock((_input: { teamId: string }) => undefined);
mock.module("@/lib/cache/invalidation", () => ({
  invalidatePublicFormBootstrapCache: invalidateMock,
}));

const { GET, PATCH } = await import("./route");

const DONO = "11111111-1111-4111-8111-111111111111";
const OUTRO = "22222222-2222-4222-8222-222222222222";

function req(method: string, headerSupabaseId?: string) {
  const headers = new Headers();
  if (headerSupabaseId) headers.set("x-supabase-user-id", headerSupabaseId);
  return new NextRequest(`http://localhost/api/v1/profiles/${OUTRO}/timezone`, {
    method,
    headers,
    ...(method === "PATCH" ? { body: JSON.stringify({ timezone: "America/Fortaleza" }) } : {}),
  });
}

const params = Promise.resolve({ supabaseId: OUTRO });

beforeEach(() => {
  getTimezoneMock.mockClear();
  updateTimezoneMock.mockClear();
  invalidateMock.mockClear();
});

/**
 * O supabaseId e o primeiro segmento de toda URL do app — nao e segredo.
 * Sem estas guardas, qualquer um que conhecesse o id de outra conta podia ler e
 * ALTERAR o fuso dela, deslocando todo horario de reuniao e janela de agenda —
 * e, depois que a invalidacao de bootstrap entrou nesta rota, tambem purgar o
 * cache de outro tenant sob demanda.
 */
describe("GET exige dono do perfil", () => {
  it("401 sem identidade", async () => {
    const response = await GET(req("GET"), { params });

    expect(response.status).toBe(401);
    expect(getTimezoneMock).not.toHaveBeenCalled();
  });

  it("403 quando o autenticado e outro perfil", async () => {
    const response = await GET(req("GET", DONO), { params });

    expect(response.status).toBe(403);
    expect(getTimezoneMock).not.toHaveBeenCalled();
  });

  it("200 para o proprio dono", async () => {
    const response = await GET(req("GET", OUTRO), { params });

    expect(response.status).toBe(200);
    expect(getTimezoneMock).toHaveBeenCalledWith(OUTRO);
  });
});

describe("PATCH exige dono do perfil", () => {
  it("401 sem identidade, sem gravar nem invalidar", async () => {
    const response = await PATCH(req("PATCH"), { params });

    expect(response.status).toBe(401);
    expect(updateTimezoneMock).not.toHaveBeenCalled();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it("403 para perfil de outra conta, sem purgar cache alheio", async () => {
    const response = await PATCH(req("PATCH", DONO), { params });

    expect(response.status).toBe(403);
    expect(updateTimezoneMock).not.toHaveBeenCalled();
    // A alavanca de purga de cache cross-tenant fica fechada.
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it("200 para o proprio dono, invalidando os times afetados", async () => {
    const response = await PATCH(req("PATCH", OUTRO), { params });

    expect(response.status).toBe(200);
    expect(updateTimezoneMock).toHaveBeenCalled();
    expect(invalidateMock).toHaveBeenCalledWith({ teamId: "team-1" });
  });
});
