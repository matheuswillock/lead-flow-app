import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";
import { Output } from "@/lib/output";

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };
let ipLimit: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
let badTokenLimit: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
const consumed: string[] = [];

mock.module("@/lib/webhooks/inbound-rate-limit", () => ({
  consumeInboundRateLimit: async (key: string): Promise<RateLimitResult> => {
    consumed.push(key);
    if (key.startsWith("api:ip:")) return ipLimit;
    if (key.startsWith("api:badtoken:")) return badTokenLimit;
    return { allowed: true, retryAfterSeconds: 0 };
  },
  INBOUND_WEBHOOK_RATE_LIMITS: {
    ip: { limit: 120, windowMs: 60_000 },
    badToken: { limit: 20, windowMs: 300_000 },
  },
}));

const { handleAvailabilityRequest } = await import("./handleAvailabilityRequest");

let useCaseResult: unknown;
const execute = mock(async (_input: { token: string; date: string | null }) => {
  const result = useCaseResult as { kind: string };
  return new Output(result.kind === "ok", [], [], useCaseResult);
});

const get = (query: string, headers: Record<string, string> = { authorization: "Bearer cs_avail_abc" }) =>
  new NextRequest(`https://app.test/api/studio/v1/availability${query}`, { method: "GET", headers });

describe("GET /api/studio/v1/availability (SPEC 14, DA5)", () => {
  beforeEach(() => {
    ipLimit = badTokenLimit = { allowed: true, retryAfterSeconds: 0 };
    consumed.length = 0;
    execute.mockClear();
    useCaseResult = { kind: "ok", body: { date: "2026-11-03", closers: [] } };
  });

  it("200 com o corpo do caso de uso, sem cache e sem CORS", async () => {
    const response = await handleAvailabilityRequest(get("?date=2026-11-03"), { useCase: { execute } });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(await response.json()).toEqual({ date: "2026-11-03", closers: [] });
    expect(execute).toHaveBeenCalledWith({ token: "cs_avail_abc", date: "2026-11-03" });
  });

  it("o limite por IP vem antes de tudo: 429 com Retry-After, sem chamar o caso de uso", async () => {
    ipLimit = { allowed: false, retryAfterSeconds: 12 };
    const response = await handleAvailabilityRequest(get("?date=2026-11-03"), { useCase: { execute } });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(execute).not.toHaveBeenCalled();
  });

  it("sem Authorization (ou com o token na query string) é 401 e conta como tentativa inválida", async () => {
    const missing = await handleAvailabilityRequest(get("?date=2026-11-03", {}), { useCase: { execute } });
    const inQuery = await handleAvailabilityRequest(get("?date=2026-11-03&token=cs_avail_abc", {}), { useCase: { execute } });
    expect(missing.status).toBe(401);
    expect(inQuery.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
    expect(consumed.filter((key) => key.startsWith("api:badtoken:"))).toHaveLength(2);
  });

  it("token inválido: 401 genérico e consome o limite de tentativas inválidas", async () => {
    useCaseResult = { kind: "error", status: 401, code: "unauthorized", message: "x" };
    const response = await handleAvailabilityRequest(get("?date=2026-11-03"), { useCase: { execute } });
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("unauthorized");
    expect(consumed.some((key) => key.startsWith("api:badtoken:"))).toBe(true);
  });

  it("muitas tentativas inválidas viram 429", async () => {
    useCaseResult = { kind: "error", status: 401, code: "unauthorized", message: "x" };
    badTokenLimit = { allowed: false, retryAfterSeconds: 30 };
    const response = await handleAvailabilityRequest(get("?date=2026-11-03"), { useCase: { execute } });
    expect(response.status).toBe(429);
  });

  it("repassa cada erro do contrato com o status e o code certos", async () => {
    const cases = [
      { status: 403, code: "resource_inactive" },
      { status: 403, code: "feature_unavailable" },
      { status: 403, code: "account_restricted" },
      { status: 400, code: "invalid_date" },
      { status: 400, code: "date_out_of_range" },
    ];
    for (const expected of cases) {
      useCaseResult = { kind: "error", message: "m", ...expected };
      const response = await handleAvailabilityRequest(get("?date=x"), { useCase: { execute } });
      expect(response.status).toBe(expected.status);
      expect((await response.json()).error).toBe(expected.code);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
  });

  it("429 do limite do token traz Retry-After", async () => {
    useCaseResult = { kind: "error", status: 429, code: "rate_limited", message: "m", retryAfterSeconds: 21 };
    const response = await handleAvailabilityRequest(get("?date=2026-11-03"), { useCase: { execute } });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("21");
  });
});
