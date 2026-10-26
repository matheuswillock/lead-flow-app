import { describe, expect, it, mock } from "bun:test";

// O módulo importa repositórios reais (Prisma) por padrão; aqui tudo entra por injeção.
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: {} }));
mock.module("@/app/api/useCases/accountAccessDecision/AccountAccessDecisionUseCase", () => ({
  accountAccessDecisionUseCase: {},
}));

const { InboundWebhookV2UseCase } = await import("./InboundWebhookV2UseCase");
const { hashStudioWebhookToken } = await import("@/lib/webhooks/studioWebhookSecurity");

const TOKEN = "token-de-teste-com-mais-de-32-caracteres-0123456789";

type WebhookRow = {
  id: string;
  teamId: string;
  status: "active" | "paused" | "disabled";
  contractVersion: number;
  scopes: string[];
  tokenHash: string | null;
  expiresAt: Date | null;
};

function webhookRow(overrides: Partial<WebhookRow> = {}): WebhookRow {
  return {
    id: "webhook-1",
    teamId: "team-1",
    status: "active",
    contractVersion: 2,
    scopes: ["leads_create", "leads_schedule"],
    tokenHash: hashStudioWebhookToken(TOKEN),
    expiresAt: null,
    ...overrides,
  };
}

const team = { teamId: "team-1", managerProfileId: "manager-1", managerSupabaseId: "sb-1" };

function build(options: { rows?: WebhookRow[]; teamFound?: boolean; accountAllowed?: boolean } = {}) {
  const receive = mock(async (_input: Record<string, unknown>) => ({
    eventId: "event-1",
    created: true,
    idempotencyKeyReused: false,
  }));
  const useCase = new InboundWebhookV2UseCase({
    webhooks: { listInboundByTeamId: async () => (options.rows ?? [webhookRow()]) as never },
    events: { receive },
    teams: {
      getTeam: async () => (options.teamFound === false ? null : team),
      isAccountAllowed: async () => options.accountAllowed ?? true,
    },
  });
  return { useCase, receive };
}

describe("InboundWebhookV2UseCase.authenticate (DA1, DA3)", () => {
  it("token válido de webhook v2 com escopo leads_create: ok", async () => {
    const { useCase } = build();
    expect(await useCase.authenticate({ teamId: "team-1", token: TOKEN })).toEqual({
      status: "ok",
      webhook: { id: "webhook-1", teamId: "team-1", scopes: ["leads_create", "leads_schedule"] },
    });
  });

  it("token errado, time sem webhook ou webhook sem token: 401 idêntico", async () => {
    const wrong = await build().useCase.authenticate({ teamId: "team-1", token: "outro-token" });
    const noWebhook = await build({ rows: [] }).useCase.authenticate({ teamId: "team-1", token: TOKEN });
    const noToken = await build({ rows: [webhookRow({ tokenHash: null })] }).useCase.authenticate({
      teamId: "team-1",
      token: TOKEN,
    });
    expect(wrong).toEqual({ status: "unauthorized" });
    expect(noWebhook).toEqual({ status: "unauthorized" });
    expect(noToken).toEqual({ status: "unauthorized" });
  });

  it("T-11.2: webhook v1 chamado pela rota v2 é version_mismatch", async () => {
    const { useCase } = build({ rows: [webhookRow({ contractVersion: 1 })] });
    expect(await useCase.authenticate({ teamId: "team-1", token: TOKEN })).toEqual({
      status: "version_mismatch",
      webhookId: "webhook-1",
    });
  });

  it("webhook pausado ou desativado: 403 webhook_inactive", async () => {
    for (const status of ["paused", "disabled"] as const) {
      const { useCase } = build({ rows: [webhookRow({ status })] });
      expect(await useCase.authenticate({ teamId: "team-1", token: TOKEN })).toEqual({
        status: "forbidden",
        reason: "webhook_inactive",
        webhookId: "webhook-1",
      });
    }
  });

  it("token vencido: token_expired", async () => {
    const { useCase } = build({ rows: [webhookRow({ expiresAt: new Date("2020-01-01T00:00:00.000Z") })] });
    expect(await useCase.authenticate({ teamId: "team-1", token: TOKEN })).toEqual({
      status: "token_expired",
      webhookId: "webhook-1",
    });
  });

  it("T-11.5: sem o escopo leads_create é 403 missing_scope", async () => {
    const { useCase } = build({ rows: [webhookRow({ scopes: ["leads_schedule"] })] });
    expect(await useCase.authenticate({ teamId: "team-1", token: TOKEN })).toEqual({
      status: "forbidden",
      reason: "missing_scope",
      webhookId: "webhook-1",
    });
  });

  it("conta pausada, suspensa ou em somente leitura: 403 account_restricted", async () => {
    const { useCase } = build({ accountAllowed: false });
    expect(await useCase.authenticate({ teamId: "team-1", token: TOKEN })).toEqual({
      status: "forbidden",
      reason: "account_restricted",
      webhookId: "webhook-1",
    });
  });

  it("escolhe o webhook pelo token quando o time tem mais de um", async () => {
    const other = webhookRow({ id: "webhook-2", tokenHash: hashStudioWebhookToken("outro-token-bem-longo-para-teste-0123456789") });
    const { useCase } = build({ rows: [other, webhookRow()] });
    const result = await useCase.authenticate({ teamId: "team-1", token: TOKEN });
    expect(result.status === "ok" && result.webhook.id).toBe("webhook-1");
  });
});

describe("InboundWebhookV2UseCase.receive (DA4, DA5)", () => {
  it("grava o evento v2 com o hash do corpo e a chave de idempotência", async () => {
    const { useCase, receive } = build();
    const result = await useCase.receive({
      webhook: { id: "webhook-1", teamId: "team-1" },
      rawBody: '{"lead":{"name":"Maria"}}',
      payload: { lead: { name: "Maria" } },
      idempotencyKey: "evento-123",
    });

    expect(result).toEqual({ eventId: "event-1", created: true, idempotencyKeyReused: false });
    expect(receive.mock.calls[0]?.[0]).toMatchObject({
      webhookId: "webhook-1",
      teamId: "team-1",
      contractVersion: 2,
      idempotencyKey: "evento-123",
      payload: { lead: { name: "Maria" } },
    });
  });

  it("o hash muda quando o corpo muda (base da detecção de idempotency_key_reused)", async () => {
    const { useCase, receive } = build();
    const base = { webhook: { id: "webhook-1", teamId: "team-1" }, payload: {}, idempotencyKey: "k" };
    await useCase.receive({ ...base, rawBody: '{"a":1}' });
    await useCase.receive({ ...base, rawBody: '{"a":2}' });
    await useCase.receive({ ...base, rawBody: '{"a":1}' });
    const hashes = receive.mock.calls.map((call) => (call[0] as { requestHash: string }).requestHash);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(hashes[0]).toBe(hashes[2]);
    expect(hashes[0]).toMatch(/^[0-9a-f]{64}$/);
  });
});
