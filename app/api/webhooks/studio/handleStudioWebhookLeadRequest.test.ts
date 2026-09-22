import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { NextRequest } from "next/server";

/**
 * SPEC 10, A-E2/A-E3 (DA2/DA3) — o handler autentica ANTES de trabalhar:
 * limite por IP → tamanho → autenticação → limites por token
 * inválido/webhook/time → leitura e validação do corpo → processamento.
 * T-10.6, T-10.7, T-10.8 (via handler), W31.
 */

type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

let ipRateLimitResult: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
let badTokenRateLimitResult: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
let teamRateLimitResult: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };
let webhookLayerRateLimitResult: RateLimitResult = { allowed: true, retryAfterSeconds: 0 };

const consumeInboundRateLimitMock = mock(async (key: string): Promise<RateLimitResult> => {
  if (key.startsWith("wh-in:ip:")) return ipRateLimitResult;
  if (key.startsWith("wh-in:badtoken:")) return badTokenRateLimitResult;
  if (key.startsWith("wh-in:team:")) return teamRateLimitResult;
  return { allowed: true, retryAfterSeconds: 0 };
});
const checkInboundWebhookLayerRateLimitMock = mock(async (): Promise<RateLimitResult> => webhookLayerRateLimitResult);

mock.module("@/lib/webhooks/inbound-rate-limit", () => ({
  consumeInboundRateLimit: consumeInboundRateLimitMock,
  checkInboundWebhookLayerRateLimit: checkInboundWebhookLayerRateLimitMock,
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

type AuthResult = {
  authenticated: boolean;
  webhookId: string | null;
  supabaseId: string | null;
  source: "team_webhook" | "legacy" | null;
};

let authOutput = {
  isValid: false,
  successMessages: [] as string[],
  errorMessages: ["Webhook token não autorizado"],
  result: { authenticated: false, webhookId: null, supabaseId: null, source: null } as AuthResult,
};

const authenticateInboundWebhookMock = mock(async () => authOutput);
const processWebhookLeadMock = mock(async () => ({
  isValid: true,
  successMessages: ["Lead criado via webhook com sucesso"],
  errorMessages: [],
  result: { id: "lead-1", leadCode: "T1234A" },
}));
const registerWebhookRequestLogMock = mock(async () => {});
const registerWebhookRateLimitRejectionMock = mock(async () => {});

mock.module("@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase", () => ({
  studioWebhookIntegrationUseCase: {
    authenticateInboundWebhook: authenticateInboundWebhookMock,
    processWebhookLead: processWebhookLeadMock,
    registerWebhookRequestLog: registerWebhookRequestLogMock,
    registerWebhookRateLimitRejection: registerWebhookRateLimitRejectionMock,
  },
  studioWebhookErrors: {
    UNAUTHORIZED_ERROR: "Webhook token não autorizado",
    TOKEN_EXPIRED_ERROR: "Webhook token expirado",
    WEBHOOK_INACTIVE_ERROR: "Webhook de entrada inativo ou pausado",
    ROTATION_REQUIRES_CONFIRMATION_ERROR: "rotation_requires_confirmation",
  },
}));

const { handleStudioWebhookLeadRequest } = await import("./handleStudioWebhookLeadRequest");

function makeRequest(options: {
  pathname?: string;
  headers?: Record<string, string>;
  body?: string;
}): { request: NextRequest; textMock: ReturnType<typeof mock> } {
  const headerMap = new Map(Object.entries(options.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  const textMock = mock(async () => options.body ?? "{}");
  const request = {
    method: "POST",
    nextUrl: { pathname: options.pathname ?? "/api/webhooks/studio/11111111-1111-4111-8111-111111111111/some-token" },
    headers: { get: (key: string) => headerMap.get(key.toLowerCase()) ?? null },
    text: textMock,
  } as unknown as NextRequest;
  return { request, textMock };
}

const VALID_TEAM_ID = "11111111-1111-4111-8111-111111111111";

async function readJson(response: Response): Promise<unknown> {
  return (response as unknown as { json?: () => Promise<unknown> }).json
    ? await (response as unknown as { json: () => Promise<unknown> }).json()
    : JSON.parse(await (response as unknown as { text: () => Promise<string> }).text());
}

describe("handleStudioWebhookLeadRequest (SPEC 10, A-E2/A-E3, DA2/DA3)", () => {
  beforeEach(() => {
    ipRateLimitResult = { allowed: true, retryAfterSeconds: 0 };
    badTokenRateLimitResult = { allowed: true, retryAfterSeconds: 0 };
    teamRateLimitResult = { allowed: true, retryAfterSeconds: 0 };
    webhookLayerRateLimitResult = { allowed: true, retryAfterSeconds: 0 };
    consumeInboundRateLimitMock.mockClear();
    checkInboundWebhookLayerRateLimitMock.mockClear();
    authenticateInboundWebhookMock.mockClear();
    processWebhookLeadMock.mockClear();
    registerWebhookRequestLogMock.mockClear();
    registerWebhookRateLimitRejectionMock.mockClear();
    authOutput = {
      isValid: false,
      successMessages: [],
      errorMessages: ["Webhook token não autorizado"],
      result: { authenticated: false, webhookId: null, supabaseId: null, source: null },
    };
  });

  afterEach(() => {
    ipRateLimitResult = { allowed: true, retryAfterSeconds: 0 };
  });

  it("T-10.6 — token inválido com corpo inválido → 401 genérico, sem log e sem mensagem de campo", async () => {
    const { request } = makeRequest({ body: "{not-json" });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-errado",
    });

    expect(response.status).toBe(401);
    const body = (await readJson(response)) as { errorMessages: string[] };
    expect(body.errorMessages).toEqual(["Webhook token não autorizado"]);
    expect(registerWebhookRequestLogMock).not.toHaveBeenCalled();
  });

  it("T-10.7 — Content-Length acima de 64 KiB → 413 sem ler o corpo", async () => {
    const { request, textMock } = makeRequest({ headers: { "content-length": String(70 * 1024) } });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-qualquer",
    });

    expect(response.status).toBe(413);
    expect(textMock).not.toHaveBeenCalled();
    expect(authenticateInboundWebhookMock).not.toHaveBeenCalled();
  });

  it("W31 — teamId malformado conta no limite de IP e não chama autenticação nem grava log", async () => {
    const { request } = makeRequest({});

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: "not-a-uuid",
      token: "token-qualquer",
    });

    expect(response.status).toBe(400);
    expect(consumeInboundRateLimitMock).toHaveBeenCalled();
    const ipCallHappened = consumeInboundRateLimitMock.mock.calls.some((call) =>
      String(call[0]).startsWith("wh-in:ip:")
    );
    expect(ipCallHappened).toBe(true);
    expect(authenticateInboundWebhookMock).not.toHaveBeenCalled();
    expect(registerWebhookRequestLogMock).not.toHaveBeenCalled();
  });

  it("429 na camada de IP → não chega a autenticar", async () => {
    ipRateLimitResult = { allowed: false, retryAfterSeconds: 42 };
    const { request } = makeRequest({});

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-qualquer",
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(authenticateInboundWebhookMock).not.toHaveBeenCalled();
  });

  it("429 na camada de token inválido → sem log", async () => {
    badTokenRateLimitResult = { allowed: false, retryAfterSeconds: 30 };
    const { request } = makeRequest({});

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-errado",
    });

    expect(response.status).toBe(429);
    expect(registerWebhookRequestLogMock).not.toHaveBeenCalled();
  });

  it("429 na camada do webhook → grava só em TeamWebhookEventLog (registerWebhookRateLimitRejection), não no log legado", async () => {
    authOutput = {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { authenticated: true, webhookId: "webhook-1", supabaseId: "supabase-1", source: "team_webhook" },
    };
    webhookLayerRateLimitResult = { allowed: false, retryAfterSeconds: 10 };
    const { request } = makeRequest({});

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    expect(response.status).toBe(429);
    expect(registerWebhookRateLimitRejectionMock).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: VALID_TEAM_ID, webhookId: "webhook-1" })
    );
    expect(registerWebhookRequestLogMock).not.toHaveBeenCalled();
  });

  it("T-10.8 (via handler) — metadata com profundidade 50 → 400 controlado, com log (identidade já resolvida)", async () => {
    authOutput = {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { authenticated: true, webhookId: "webhook-1", supabaseId: "supabase-1", source: "team_webhook" },
    };
    let deepMetadata: unknown = { leaf: true };
    for (let i = 0; i < 50; i += 1) deepMetadata = { nested: deepMetadata };
    const { request } = makeRequest({
      body: JSON.stringify({ name: "Lead X", email: "lead@example.com", phone: "11999999999", metadata: deepMetadata }),
    });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    expect(response.status).toBe(400);
    expect(processWebhookLeadMock).not.toHaveBeenCalled();
    expect(registerWebhookRequestLogMock).toHaveBeenCalled();
  });

  it("R10-7 — profundidade 50 numa chave DESCONHECIDA (não 'metadata') → 400, nunca chega a processWebhookLead", async () => {
    // R10-7 (revisão Opus, Protocolo 96, rodada 2): o guard de profundidade
    // (T-10.8) só olhava `metadata`; uma chave desconhecida aninhada
    // passava direto pelo scanner de SQLi recursivo (que roda ANTES do
    // `.strict()` do zod). Minha primeira medição (empírica, mas no runtime
    // e formato errados — Bun, objeto aninhado) subestimou o risco. O
    // revisor mediu corretamente: em produção (Node, Vercel) e com array
    // aninhado (mais barato em bytes por nível), a pilha estoura já em
    // ~5.900 níveis, dentro do teto de 64KB — vira 500, não 400 controlado.
    // Corrigido com um teto de profundidade no PAYLOAD INTEIRO (não só
    // metadata), aplicado ANTES do scan de SQLi. Este teste cobre a chave
    // desconhecida rasa (50 níveis); o teste seguinte cobre a profundidade
    // real do ataque (array, dezenas de milhares de níveis).
    authOutput = {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { authenticated: true, webhookId: "webhook-1", supabaseId: "supabase-1", source: "team_webhook" },
    };
    let deepUnknownField: unknown = { leaf: true };
    for (let i = 0; i < 50; i += 1) deepUnknownField = { nested: deepUnknownField };
    const { request } = makeRequest({
      body: JSON.stringify({
        name: "Lead X",
        email: "lead@example.com",
        phone: "11999999999",
        chaveNaoDeclarada: deepUnknownField,
      }),
    });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    expect(response.status).toBe(400);
    expect(processWebhookLeadMock).not.toHaveBeenCalled();
  });

  it("R10-7 (rodada 2) — array aninhado com dezenas de milhares de níveis numa chave desconhecida → 400 controlado, não 500 (não estoura a pilha)", async () => {
    authOutput = {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { authenticated: true, webhookId: "webhook-1", supabaseId: "supabase-1", source: "team_webhook" },
    };
    // Reprodução do achado do revisor: array aninhado é ~2 bytes/nível,
    // então 30.000 níveis cabem folgado no teto de 64KB do corpo (~60KB) e
    // já estouram a pilha do scanner recursivo sem a correção (medido:
    // JSON.stringify aguenta até ~31k, o scanner recursivo quebra a partir
    // de 30k neste runtime — a margem exata varia por overhead de frame,
    // mas o vetor é real em qualquer runtime de pilha limitada).
    let deepArray: unknown = ["leaf"];
    for (let i = 0; i < 30_000; i += 1) deepArray = [deepArray];
    const { request } = makeRequest({
      body: JSON.stringify({
        name: "Lead X",
        email: "lead@example.com",
        phone: "11999999999",
        chaveNaoDeclarada: deepArray,
      }),
    });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    // Antes da correção (teto só em `metadata`), isto chegava ao scanner de
    // SQLi recursivo e derrubava a requisição com RangeError (500). Agora o
    // teto de profundidade do payload inteiro barra antes, com 400.
    expect(response.status).toBe(400);
    expect(processWebhookLeadMock).not.toHaveBeenCalled();
  });

  it("fluxo completo autenticado e dentro dos limites → 201 e log de sucesso", async () => {
    authOutput = {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { authenticated: true, webhookId: "webhook-1", supabaseId: "supabase-1", source: "team_webhook" },
    };
    const { request } = makeRequest({
      body: JSON.stringify({ name: "Lead X", email: "lead@example.com", phone: "11999999999" }),
    });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    expect(response.status).toBe(201);
    expect(processWebhookLeadMock).toHaveBeenCalledTimes(1);
    expect(registerWebhookRequestLogMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 201, resultType: "success" })
    );
  });

  it("R10-18 — payload autenticado e válido de ~20KB (dentro do teto de 64KB do corpo) → 201, não 400 por 'payload inválido'", async () => {
    // Regressão do R10-7: o guard de profundidade do payload inteiro
    // herdava por engano o teto de BYTES de `metadata` (8 KiB, DA6) em vez
    // do teto do corpo inteiro (64 KiB, DA2/T-10.7). Um payload legítimo
    // (ex.: `current_treatment` com texto longo) entre 8KB e 64KB não podia
    // ser rejeitado.
    authOutput = {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { authenticated: true, webhookId: "webhook-1", supabaseId: "supabase-1", source: "team_webhook" },
    };
    const longTreatmentNote = "x".repeat(20 * 1024);
    const { request } = makeRequest({
      body: JSON.stringify({
        name: "Lead X",
        email: "lead@example.com",
        phone: "11999999999",
        current_treatment: longTreatmentNote,
      }),
    });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    expect(response.status).toBe(201);
    expect(processWebhookLeadMock).toHaveBeenCalledTimes(1);
  });

  it("R10-18 — metadata com profundidade 3 (profundidade total 4 no payload) continua passando", async () => {
    authOutput = {
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { authenticated: true, webhookId: "webhook-1", supabaseId: "supabase-1", source: "team_webhook" },
    };
    const { request } = makeRequest({
      body: JSON.stringify({
        name: "Lead X",
        email: "lead@example.com",
        phone: "11999999999",
        metadata: { a: { b: { c: "profundidade 3 dentro de metadata" } } },
      }),
    });

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    expect(response.status).toBe(201);
    expect(processWebhookLeadMock).toHaveBeenCalledTimes(1);
  });

  it("identidade resolvida mas webhook pausado (403) → loga com detalhe", async () => {
    authOutput = {
      isValid: false,
      successMessages: [],
      errorMessages: ["Webhook de entrada inativo ou pausado"],
      result: { authenticated: false, webhookId: "webhook-1", supabaseId: null, source: "team_webhook" },
    };
    const { request } = makeRequest({});

    const response = await handleStudioWebhookLeadRequest({
      request,
      routePrefix: "[test]",
      teamId: VALID_TEAM_ID,
      token: "token-certo",
    });

    expect(response.status).toBe(403);
    expect(registerWebhookRequestLogMock).toHaveBeenCalled();
    expect(processWebhookLeadMock).not.toHaveBeenCalled();
  });
});
