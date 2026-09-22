import { describe, expect, it, mock } from "bun:test";
import { Output } from "@/lib/output";

/**
 * SPEC 40 A-E1/R40-9 (V3): a nota da SPEC declara que `/availability`,
 * `/bootstrap`, `/pre-schedule-slots` e `/team-closers` "continuam existindo
 * ... protegidos pela A-E1" — sem limite, dava para varrer a agenda/membros
 * de qualquer time só com o `teamId` (público por desenho) em série, sem
 * criar nenhum lead (então nem o limite do `lead-form` POST entrava em jogo).
 */

const getCloserAvailabilityMock = mock(async () => new Output(true, [], [], { availableTimes: [], source: "internal" }));
const getPublicFormBootstrapMock = mock(async () => new Output(true, [], [], { teamName: "T" }));
const getPreScheduleSlotsMock = mock(async () => new Output(true, [], [], {}));
const getTeamClosersMock = mock(async () => new Output(true, [], [], { closers: [] }));
const consumePublicFormRateLimitMock = mock(async (_key: string, _options: { limit: number; windowMs: number }) => ({
  allowed: true,
  retryAfterSeconds: 0,
}));

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
  return { NextResponse, NextRequest: Request, connection: async () => {} };
});

mock.module("@/app/api/useCases/integrations/PublicLeadFormUseCase", () => ({
  publicLeadFormUseCase: {
    getCloserAvailability: getCloserAvailabilityMock,
    getPublicFormBootstrap: getPublicFormBootstrapMock,
    getPreScheduleSlots: getPreScheduleSlotsMock,
    getTeamClosers: getTeamClosersMock,
  },
}));

mock.module("@/lib/public-forms/rate-limit", () => ({
  consumePublicFormRateLimit: consumePublicFormRateLimitMock,
  publicFormRequestFingerprint: () => "203.0.113.10",
}));

const { POST: availabilityPOST } = await import("./availability/route");
const { GET: bootstrapGET } = await import("./bootstrap/route");
const { GET: preScheduleGET } = await import("./pre-schedule-slots/route");
const { GET: teamClosersGET } = await import("./team-closers/route");

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const CLOSER_ID = "22222222-2222-4222-8222-222222222222";

function resetMocks() {
  getCloserAvailabilityMock.mockClear();
  getPublicFormBootstrapMock.mockClear();
  getPreScheduleSlotsMock.mockClear();
  getTeamClosersMock.mockClear();
  consumePublicFormRateLimitMock.mockReset();
  consumePublicFormRateLimitMock.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
}

describe("Endpoints públicos de agenda/bootstrap — limite de taxa (R40-9)", () => {
  it("availability: cota estourada → 429, sem chamar o use case", async () => {
    resetMocks();
    consumePublicFormRateLimitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });

    const request = new Request("http://localhost/api/v1/integrations/availability", {
      method: "POST",
      body: JSON.stringify({ teamId: TEAM_ID, closerId: CLOSER_ID, date: "2026-10-01" }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await availabilityPOST(request as never);

    expect(response.status).toBe(429);
    expect(getCloserAvailabilityMock).not.toHaveBeenCalled();
  });

  it("bootstrap: cota estourada → 429, sem chamar o use case", async () => {
    resetMocks();
    consumePublicFormRateLimitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });

    const request = new Request(`http://localhost/api/v1/integrations/bootstrap?teamId=${TEAM_ID}`);
    const response = await bootstrapGET(request as never);

    expect(response.status).toBe(429);
    expect(getPublicFormBootstrapMock).not.toHaveBeenCalled();
  });

  it("pre-schedule-slots: cota estourada → 429, sem chamar o use case", async () => {
    resetMocks();
    consumePublicFormRateLimitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });

    const request = new Request(
      `http://localhost/api/v1/integrations/pre-schedule-slots?teamId=${TEAM_ID}&date=2026-10-01`
    );
    const response = await preScheduleGET(request as never);

    expect(response.status).toBe(429);
    expect(getPreScheduleSlotsMock).not.toHaveBeenCalled();
  });

  it("team-closers: cota estourada → 429, sem chamar o use case", async () => {
    resetMocks();
    consumePublicFormRateLimitMock.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 });

    const request = new Request(`http://localhost/api/v1/integrations/team-closers?teamId=${TEAM_ID}`);
    const response = await teamClosersGET(request as never);

    expect(response.status).toBe(429);
    expect(getTeamClosersMock).not.toHaveBeenCalled();
  });

  it("dentro da cota: availability, pre-schedule-slots e team-closers seguem chamando o use case normalmente", async () => {
    // `bootstrap/route.ts` fica de fora deste teste: sua função cacheada usa
    // a diretiva `"use cache"` do Next.js (`cacheTag`/`cacheLife`), que só
    // funciona dentro do runtime real do Next (com `cacheComponents`
    // habilitado) — fora dele, `cacheTag()` lança sempre, mesmo sem relação
    // com o limite de taxa. O teste de 429 do bootstrap acima já prova que o
    // limite intercepta ANTES dessa função ser chamada, que é o que R40-9
    // pede; o caminho feliz do bootstrap é coberto pelo E2E
    // (`e2e/specs/public/lead-form.spec.ts`, que roda no Next real).
    resetMocks();

    const availabilityResponse = await availabilityPOST(
      new Request("http://localhost/api/v1/integrations/availability", {
        method: "POST",
        body: JSON.stringify({ teamId: TEAM_ID, closerId: CLOSER_ID, date: "2026-10-01" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const preScheduleResponse = await preScheduleGET(
      new Request(
        `http://localhost/api/v1/integrations/pre-schedule-slots?teamId=${TEAM_ID}&date=2026-10-01`
      ) as never
    );
    const teamClosersResponse = await teamClosersGET(
      new Request(`http://localhost/api/v1/integrations/team-closers?teamId=${TEAM_ID}`) as never
    );

    expect(availabilityResponse.status).toBe(200);
    expect(preScheduleResponse.status).toBe(200);
    expect(teamClosersResponse.status).toBe(200);
    expect(getCloserAvailabilityMock).toHaveBeenCalledTimes(1);
    expect(getPreScheduleSlotsMock).toHaveBeenCalledTimes(1);
    expect(getTeamClosersMock).toHaveBeenCalledTimes(1);
  });
});
