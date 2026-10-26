import { beforeEach, describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

let ipLimit: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
let badTokenLimit: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
let teamLimit: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
let webhookLimit: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };

mock.module("@/lib/webhooks/inbound-rate-limit", () => ({
  consumeInboundRateLimit: async (key: string): Promise<RateLimitResult> => {
    if (key.startsWith("wh-in:ip:")) return ipLimit;
    if (key.startsWith("wh-in:badtoken:")) return badTokenLimit;
    if (key.startsWith("wh-in:team:")) return teamLimit;
    return { allowed: true, retryAfterSeconds: 0 };
  },
  checkInboundWebhookLayerRateLimit: async () => webhookLimit,
  buildInboundWebhookIpKey: (ip: string) => `wh-in:ip:${ip}`,
  buildInboundWebhookBadTokenKey: (teamId: string, ip: string) => `wh-in:badtoken:${teamId}:${ip}`,
  buildInboundWebhookTeamKey: (teamId: string) => `wh-in:team:${teamId}`,
  INBOUND_WEBHOOK_RATE_LIMITS: {
    ip: { limit: 120, windowMs: 60_000 },
    badToken: { limit: 20, windowMs: 5 * 60_000 },
    webhookPerMinute: { limit: 60, windowMs: 60_000 },
    webhookPerHour: { limit: 1000, windowMs: 60 * 60_000 },
    team: { limit: 300, windowMs: 60_000 },
  },
}));

// O handler importa o caso de uso real por padrão; os testes injetam o dublê.
mock.module("@/app/api/useCases/integrations/webhooks/inbound/InboundWebhookV2UseCase", () => ({
  inboundWebhookV2UseCase: {},
}));

const { handleStudioWebhookV2Request } = await import("./handleStudioWebhookV2Request");

const TEAM_ID = "5b1e0ef3-4e8f-4d0b-9b6a-1e2d3c4b5a69";

type AuthResult = Awaited<ReturnType<(typeof import("@/app/api/useCases/integrations/webhooks/inbound/InboundWebhookV2UseCase"))["inboundWebhookV2UseCase"]["authenticate"]>>;

let authResult: AuthResult = { status: "ok", webhook: { id: "webhook-1", teamId: TEAM_ID, scopes: ["leads_create"] } };
let receiveResult = { eventId: "event-1", created: true, idempotencyKeyReused: false };

const authenticate = mock(async (_input: { teamId: string; token: string }) => authResult);
const receive = mock(async (_input: Record<string, unknown>) => receiveResult);
const process = mock(async (_eventId: string) => undefined);
const scheduled: Array<() => Promise<void>> = [];

const deps = {
  useCase: { authenticate, receive } as never,
  schedule: (task: () => Promise<void>) => {
    scheduled.push(task);
  },
  process,
};

function post(body: unknown, headers: Record<string, string> = { authorization: "Bearer token-valido" }, raw = false) {
  return new NextRequest(`https://app.test/api/webhooks/studio/v2/${TEAM_ID}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

const validBody = { lead: { name: "Maria Souza", phone: "+5511999998888" } };

describe("handleStudioWebhookV2Request — defesas antes de trabalhar (DA4)", () => {
  beforeEach(() => {
    ipLimit = badTokenLimit = teamLimit = webhookLimit = { allowed: true, retryAfterSeconds: 0 };
    authResult = { status: "ok", webhook: { id: "webhook-1", teamId: TEAM_ID, scopes: ["leads_create"] } };
    receiveResult = { eventId: "event-1", created: true, idempotencyKeyReused: false };
    authenticate.mockClear();
    receive.mockClear();
    process.mockClear();
    scheduled.length = 0;
  });

  it("429 com Retry-After quando o IP estoura o limite, antes de qualquer outra coisa", async () => {
    ipLimit = { allowed: false, retryAfterSeconds: 42 };
    const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("400 para teamId que não é UUID", async () => {
    const response = await handleStudioWebhookV2Request(post(validBody), "nao-e-uuid", deps);
    expect(response.status).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("413 por Content-Length acima de 64 KiB, sem ler o corpo nem autenticar", async () => {
    const response = await handleStudioWebhookV2Request(
      post(validBody, { authorization: "Bearer token-valido", "content-length": String(64 * 1024 + 1) }),
      TEAM_ID,
      deps,
    );
    expect(response.status).toBe(413);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("401 sem Authorization e 401 com esquema que não é Bearer (token no path/query não vale)", async () => {
    const missing = await handleStudioWebhookV2Request(post(validBody, {}), TEAM_ID, deps);
    const basic = await handleStudioWebhookV2Request(post(validBody, { authorization: "Basic abc" }), TEAM_ID, deps);
    expect(missing.status).toBe(401);
    expect(basic.status).toBe(401);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("401 genérico para token inválido, e 429 quando as tentativas inválidas estouram", async () => {
    authResult = { status: "unauthorized" };
    expect((await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps)).status).toBe(401);

    badTokenLimit = { allowed: false, retryAfterSeconds: 10 };
    const limited = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(limited.status).toBe(429);
    expect(receive).not.toHaveBeenCalled();
  });

  it("T-11.2: webhook de outra versão devolve 400 version_mismatch", async () => {
    authResult = { status: "version_mismatch", webhookId: "webhook-1" };
    const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("version_mismatch");
  });

  it("403 para webhook inativo, sem escopo leads_create e conta pausada, cada um com o seu código", async () => {
    for (const reason of ["webhook_inactive", "missing_scope", "account_restricted"] as const) {
      authResult = { status: "forbidden", reason, webhookId: "webhook-1" };
      const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
      expect(response.status).toBe(403);
      expect((await response.json()).error).toBe(reason);
    }
  });

  it("401 token_expired", async () => {
    authResult = { status: "token_expired", webhookId: "webhook-1" };
    const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe("token_expired");
  });

  it("429 por limite do webhook e por limite do time, só depois de autenticar", async () => {
    webhookLimit = { allowed: false, retryAfterSeconds: 5 };
    expect((await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps)).status).toBe(429);
    webhookLimit = { allowed: true, retryAfterSeconds: 0 };
    teamLimit = { allowed: false, retryAfterSeconds: 7 };
    const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("7");
    expect(receive).not.toHaveBeenCalled();
  });

  it("400 invalid_json para corpo malformado, vazio, array ou texto", async () => {
    for (const raw of ["{nao-e-json", "", "[]", '"texto"', "null"]) {
      const response = await handleStudioWebhookV2Request(post(raw, undefined, true), TEAM_ID, deps);
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe("invalid_json");
    }
    expect(receive).not.toHaveBeenCalled();
  });

  it("400 invalid_json para estrutura profunda demais", async () => {
    let deep: Record<string, unknown> = { fim: true };
    for (let level = 0; level < 20; level += 1) deep = { nivel: deep };
    const response = await handleStudioWebhookV2Request(post({ ...validBody, metadata: deep }), TEAM_ID, deps);
    expect(response.status).toBe(400);
  });

  it("400 para Idempotency-Key com mais de 255 caracteres", async () => {
    const response = await handleStudioWebhookV2Request(
      post(validBody, { authorization: "Bearer token-valido", "idempotency-key": "x".repeat(256) }),
      TEAM_ID,
      deps,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("invalid_idempotency_key");
  });
});

describe("handleStudioWebhookV2Request — 202 fire and forget (DA4, DA5)", () => {
  beforeEach(() => {
    ipLimit = badTokenLimit = teamLimit = webhookLimit = { allowed: true, retryAfterSeconds: 0 };
    authResult = { status: "ok", webhook: { id: "webhook-1", teamId: TEAM_ID, scopes: ["leads_create"] } };
    receiveResult = { eventId: "event-1", created: true, idempotencyKeyReused: false };
    authenticate.mockClear();
    receive.mockClear();
    process.mockClear();
    scheduled.length = 0;
  });

  it("202 com received e event_id, e nunca devolve lead_id nem resultado do processamento", async () => {
    const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ received: true, event_id: "event-1" });
  });

  it("agenda o processamento do evento recém-criado em vez de rodar antes de responder", async () => {
    await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(scheduled).toHaveLength(1);
    expect(process).not.toHaveBeenCalled();
    await scheduled[0]();
    expect(process).toHaveBeenCalledWith("event-1");
  });

  it("T-11.6: campo obrigatório faltando também recebe 202 (a validação é assíncrona)", async () => {
    const response = await handleStudioWebhookV2Request(post({ lead: {} }), TEAM_ID, deps);
    expect(response.status).toBe(202);
    expect(receive).toHaveBeenCalledTimes(1);
  });

  it("usa o header Idempotency-Key; sem ele, o external_id do corpo; sem nenhum, não há chave", async () => {
    await handleStudioWebhookV2Request(
      post({ ...validBody, external_id: "do-corpo" }, { authorization: "Bearer token-valido", "idempotency-key": "do-header" }),
      TEAM_ID,
      deps,
    );
    await handleStudioWebhookV2Request(post({ ...validBody, external_id: "do-corpo" }), TEAM_ID, deps);
    await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);

    const keys = receive.mock.calls.map((call) => (call[0] as { idempotencyKey: string | null }).idempotencyKey);
    expect(keys).toEqual(["do-header", "do-corpo", null]);
  });

  it("T-11.7: replay da mesma chave devolve o mesmo event_id e não processa de novo", async () => {
    receiveResult = { eventId: "event-original", created: false, idempotencyKeyReused: false };
    const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect(response.status).toBe(202);
    expect((await response.json()).event_id).toBe("event-original");
    expect(scheduled).toHaveLength(0);
  });

  it("T-11.8: mesma chave com corpo diferente também devolve o event_id original", async () => {
    receiveResult = { eventId: "event-original", created: false, idempotencyKeyReused: true };
    const response = await handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps);
    expect((await response.json()).event_id).toBe("event-original");
    expect(scheduled).toHaveLength(0);
  });

  it("falha ao gravar o evento propaga: o integrador recebe 5xx e reenvia com a mesma chave", async () => {
    receive.mockRejectedValueOnce(new Error("banco indisponível"));
    await expect(handleStudioWebhookV2Request(post(validBody), TEAM_ID, deps)).rejects.toThrow("banco indisponível");
    expect(scheduled).toHaveLength(0);
  });
});
