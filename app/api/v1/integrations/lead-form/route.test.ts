import { describe, expect, it, mock } from "bun:test";
import { Output } from "@/lib/output";

/**
 * SPEC 40 A-E1 (V3, DA1): limite de taxa por IP+time (10/10min) e por time
 * (200/hora), fail-closed. Testa a fiação da rota — o comportamento
 * fail-closed do limitador em si já tem cobertura própria em
 * `lib/public-forms/rate-limit.fail-closed.test.ts` (T-40.2); aqui provamos
 * que quando o limitador recusa (por estourar a cota OU por indisponibilidade
 * do banco), a rota devolve 429 sem nunca chamar o UseCase que cria o lead.
 */

const createPublicLeadMock = mock(async () => new Output(true, ["Lead cadastrado com sucesso!"], [], { id: "lead-1" }));
const consumePublicFormRateLimitMock = mock(async (_key: string, _options: { limit: number; windowMs: number }) => ({
  allowed: true,
  retryAfterSeconds: 0,
}));
const invalidateLeadCacheMock = mock(() => {});

mock.module("next/server", () => {
  class NextResponse {
    status: number;
    body: unknown;
    headers: Map<string, string>;
    constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      this.body = body;
      this.status = init?.status ?? 200;
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }
    static json(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
      return new NextResponse(body, init);
    }
  }
  return { NextResponse, NextRequest: Request };
});

mock.module("@/app/api/useCases/integrations/PublicLeadFormUseCase", () => ({
  publicLeadFormUseCase: { createPublicLead: createPublicLeadMock },
  PUBLIC_LEAD_FORM_NEUTRAL_SUCCESS_MESSAGE: "Lead cadastrado com sucesso!",
}));

mock.module("@/lib/public-forms/rate-limit", () => ({
  consumePublicFormRateLimit: consumePublicFormRateLimitMock,
  publicFormRequestFingerprint: () => "203.0.113.10",
}));

mock.module("@/lib/cache/invalidation", () => ({
  invalidateLeadCache: invalidateLeadCacheMock,
}));

const { POST } = await import("./route");

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const SDR_ID = "22222222-2222-4222-8222-222222222222";

const VALID_BODY = {
  teamId: TEAM_ID,
  name: "Fulano de Tal",
  phone: "11999998888",
  assignedTo: SDR_ID,
};

function makeRequest(body: unknown = VALID_BODY) {
  return new Request("http://localhost/api/v1/integrations/lead-form", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  }) as unknown as Parameters<typeof POST>[0];
}

function resetMocks() {
  createPublicLeadMock.mockReset();
  createPublicLeadMock.mockResolvedValue(new Output(true, ["Lead cadastrado com sucesso!"], [], { id: "lead-1" }));
  consumePublicFormRateLimitMock.mockReset();
  consumePublicFormRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  invalidateLeadCacheMock.mockReset();
}

describe("Lead form route — limite de taxa (SPEC 40 A-E1, T-40.2)", () => {
  it("cota de IP+time estourada → 429 com Retry-After, sem chamar o UseCase", async () => {
    resetMocks();
    consumePublicFormRateLimitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42 });

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect((response as unknown as { headers: Map<string, string> }).headers.get("Retry-After")).toBe("42");
    expect(createPublicLeadMock).not.toHaveBeenCalled();
    const body = (response as unknown as { body: Output }).body;
    expect(body.errorMessages[0]).not.toMatch(/sql|prisma|stack|exception/i);
  });

  it("cota por time estourada (2ª checagem) → 429, sem chamar o UseCase", async () => {
    resetMocks();
    consumePublicFormRateLimitMock
      .mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 }) // IP+time OK
      .mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 900 }); // por time estourou

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(createPublicLeadMock).not.toHaveBeenCalled();
  });

  it("limitador indisponível (fail-closed do lib) → rota também recusa com 429 (T-40.2)", async () => {
    resetMocks();
    // `consumePublicFormRateLimit` real já falha fechado (retorna
    // allowed:false) quando o Postgres não responde — aqui simulamos esse
    // retorno para provar que a ROTA propaga a recusa em vez de tratá-la como
    // "sem limite" e seguir para criar o lead.
    consumePublicFormRateLimitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 });

    const response = await POST(makeRequest());

    expect(response.status).toBe(429);
    expect(createPublicLeadMock).not.toHaveBeenCalled();
  });

  it("dentro da cota → segue normalmente e chama o UseCase", async () => {
    resetMocks();

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);
    expect(createPublicLeadMock).toHaveBeenCalledTimes(1);
    expect(consumePublicFormRateLimitMock).toHaveBeenCalledTimes(2);
  });

  it("chave do limite por IP+time inclui o teamId do payload (isolamento entre times)", async () => {
    resetMocks();

    await POST(makeRequest());

    const firstCallKey = consumePublicFormRateLimitMock.mock.calls[0]?.[0];
    expect(firstCallKey).toContain(TEAM_ID);
  });
});

describe("Lead form route — resposta pública nunca leva `result` do lead (R40-1/R40-2)", () => {
  it("sucesso (sem duplicata) com lead cheio (manager/assignee/closer com e-mail) → resposta pública com result:null", async () => {
    resetMocks();
    // Formato real do que `LeadUseCase.createLead` devolve (ver
    // `LeadRepository.ts` — `manager`/`assignee`/`closer` sempre com
    // `email`, campo legítimo pro CRM autenticado). R40-1: antes desta
    // correção, `route.ts` repassava esse objeto inteiro na resposta HTTP
    // de um POST anônimo bem-sucedido.
    createPublicLeadMock.mockResolvedValueOnce(
      new Output(true, ["Lead cadastrado com sucesso!"], [], {
        id: "lead-1",
        leadCode: "T0001A",
        manager: { id: "m-1", fullName: "Dono do Time", email: "dono@example.com" },
        assignee: { id: "a-1", fullName: "SDR", email: "sdr@example.com", avatarUrl: null },
        closer: { id: "c-1", fullName: "Closer", email: "closer@example.com", avatarUrl: null },
      })
    );

    const response = await POST(makeRequest());
    const body = (response as unknown as { body: { isValid: boolean; result: unknown } }).body;

    expect(response.status).toBe(201);
    expect(body.result).toBeNull();
    expect(JSON.stringify(body)).not.toContain("@example.com");
  });

  it("sucesso e duplicata neutralizada produzem o MESMO corpo de resposta (R40-2)", async () => {
    resetMocks();
    createPublicLeadMock.mockResolvedValueOnce(
      new Output(true, ["Lead cadastrado com sucesso!"], [], { id: "lead-1", leadCode: "T0001A" })
    );
    const successResponse = await POST(makeRequest());
    const successBody = (successResponse as unknown as { body: unknown }).body;

    resetMocks();
    createPublicLeadMock.mockResolvedValueOnce(
      // O que `PublicLeadFormUseCase.buildNeutralAcceptedResponse()` devolve
      // para uma duplicata.
      new Output(true, ["Lead cadastrado com sucesso!"], [], null)
    );
    const duplicateResponse = await POST(makeRequest());
    const duplicateBody = (duplicateResponse as unknown as { body: unknown }).body;

    expect(successResponse.status).toBe(duplicateResponse.status);
    expect(successBody).toEqual(duplicateBody);
  });
});
