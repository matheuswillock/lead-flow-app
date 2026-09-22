import { beforeEach, describe, expect, it, mock } from "bun:test";

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "webhook-1",
    teamId: "team-1",
    direction: "outbound" as const,
    status: "active" as const,
    name: "Meu webhook",
    targetUrl: "https://example.com/hook",
    destinationPreset: "generic" as const,
    selectedEvents: ["lead_created"] as const,
    failureStreak: 0,
    failureThreshold: 10,
    pausedAt: null,
    pauseReason: null,
    tokenHash: null,
    tokenCipher: null,
    tokenPreview: null,
    signingSecretCipher: "v1.aaaa.bbbb.cccc",
    signingSecretPreview: "abcd1234...ef99",
    expiryMode: null,
    expiresAt: null,
    lastUsedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    updatedByProfileId: "profile-1",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

const createWithCtxMock = mock(async (_ctx: unknown, data: Record<string, unknown>) =>
  baseRow({ signingSecretCipher: data.signingSecretCipher, signingSecretPreview: data.signingSecretPreview })
);
const findByIdWithCtxMock = mock(async () => baseRow());
const updateWithCtxMock = mock(async (_ctx: unknown, _id: string, data: Record<string, unknown>) =>
  baseRow({ signingSecretCipher: data.signingSecretCipher, signingSecretPreview: data.signingSecretPreview })
);

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository", () => ({
  teamWebhookRepository: {
    createWithCtx: createWithCtxMock,
    findByIdWithCtx: findByIdWithCtxMock,
    updateWithCtx: updateWithCtxMock,
    countOutboundWithCtx: async () => 0,
    findForDelivery: async () => baseRow(),
    touchUsage: async () => {},
  },
}));

const eventLogCreateMock = mock(async (_input: unknown) => {});

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository", () => ({
  teamWebhookEventLogRepository: {
    create: eventLogCreateMock,
  },
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository", () => ({
  teamWebhookOutboxRepository: {},
}));

mock.module("@/lib/webhooks/ssrfUrlGuard", () => ({
  assertSafeWebhookTargetUrlResolved: async (targetUrl: string) => ({
    ok: true,
    url: new URL(targetUrl),
  }),
}));

const deliverMock = mock(async (_args: unknown) => ({
  ok: true,
  statusCode: 200,
  responseBody: { ok: true },
  errorMessage: null,
}));

mock.module("@/app/api/services/teamWebhook/WebhookHttpDeliveryService", () => ({
  webhookHttpDeliveryService: {
    deliver: deliverMock,
  },
}));

const { TeamWebhookService } = await import("./TeamWebhookService");

const access = {
  profileId: "profile-1",
  teamId: "team-1",
  teamMember: { role: "manager" },
} as never;

describe("TeamWebhookService — segredo de assinatura (T-20.2)", () => {
  beforeEach(() => {
    createWithCtxMock.mockClear();
    findByIdWithCtxMock.mockClear();
    updateWithCtxMock.mockClear();
    eventLogCreateMock.mockClear();
    deliverMock.mockClear();
  });

  it("create() devolve o segredo em texto puro uma única vez, e nunca a cifra", async () => {
    const service = new TeamWebhookService();
    const result = await service.create(
      access,
      {
        direction: "outbound",
        name: "Novo webhook",
        targetUrl: "https://example.com/hook",
        destinationPreset: "generic",
        selectedEvents: ["lead_created"],
      },
      "https://app.example.com"
    );

    expect(typeof result.signingSecret).toBe("string");
    expect((result.signingSecret as string).length).toBeGreaterThan(0);
    expect(result.signingSecretPreview).toBeTruthy();

    // O DTO nunca inclui a cifra nem qualquer chave "Cipher".
    expect(Object.keys(result)).not.toContain("signingSecretCipher");
    expect(JSON.stringify(result)).not.toContain("v1.aaaa.bbbb.cccc");

    // O que foi persistido é a cifra, não o segredo em texto puro.
    const persisted = createWithCtxMock.mock.calls[0]?.[1] as {
      signingSecretCipher: string;
      signingSecretPreview: string;
    };
    expect(persisted.signingSecretCipher).not.toBe(result.signingSecret);
    expect(persisted.signingSecretPreview).not.toBe(result.signingSecret);
  });

  it("getById() nunca devolve o segredo em texto puro nem a cifra, só o preview", async () => {
    const service = new TeamWebhookService();
    const result = await service.getById(access, "webhook-1", "https://app.example.com");

    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("signingSecret");
    expect(result).not.toHaveProperty("signingSecretCipher");
    expect(result?.signingSecretPreview).toBe("abcd1234...ef99");
  });

  it("rotateSigningSecret() gera um novo segredo, cifra antes de persistir, e devolve o texto puro uma vez", async () => {
    const service = new TeamWebhookService();
    const result = await service.rotateSigningSecret(access, "webhook-1", "https://app.example.com");

    expect(typeof result.signingSecret).toBe("string");
    expect(result.signingSecret.length).toBeGreaterThan(0);

    const persisted = updateWithCtxMock.mock.calls[0]?.[2] as {
      signingSecretCipher: string;
      signingSecretPreview: string;
    };
    expect(persisted.signingSecretCipher).not.toBe(result.signingSecret);
    expect(persisted.signingSecretCipher).toBeTruthy();
  });

  it("rotateSigningSecret() recusa webhook de entrada", async () => {
    findByIdWithCtxMock.mockImplementationOnce(async () => baseRow({ direction: "inbound" }));
    const service = new TeamWebhookService();
    await expect(
      service.rotateSigningSecret(access, "webhook-1", "https://app.example.com")
    ).rejects.toThrow(/saída/);
  });

  it("R20-6: testDelivery() bloqueia o teste quando a cifra existe mas é ilegível, sem chamar deliver()", async () => {
    findByIdWithCtxMock.mockImplementationOnce(async () =>
      baseRow({ signingSecretCipher: "lixo-nao-e-uma-cifra-valida" })
    );
    const service = new TeamWebhookService();

    const result = await service.testDelivery(access, "webhook-1");

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe("Segredo de assinatura ilegível — teste bloqueado por segurança");
    // Nunca chega a fazer POST sem assinatura — o bloqueio acontece antes do transporte HTTP.
    expect(deliverMock).not.toHaveBeenCalled();
    expect(eventLogCreateMock).toHaveBeenCalledTimes(1);
    const loggedCall = eventLogCreateMock.mock.calls[0]?.[0] as { result: string; errorMessage: string };
    expect(loggedCall.result).toBe("failure");
    expect(loggedCall.errorMessage).toBe("Segredo de assinatura ilegível — teste bloqueado por segurança");
  });
});
