import { describe, expect, it, mock } from "bun:test";

/**
 * SPEC 10, W23 — sem limite de webhooks de ENTRADA por time (só existia
 * para saída, `MAX_OUTBOUND_PER_TEAM`). `MAX_INBOUND_PER_TEAM = 10`.
 */
const countInboundWithCtxMock = mock(async (): Promise<number> => 0);
const createWithCtxMock = mock(async () => ({
  id: "inbound-new",
  teamId: "team-1",
  direction: "inbound" as const,
  status: "active" as const,
  name: "Novo webhook",
  targetUrl: null,
  destinationPreset: null,
  selectedEvents: [],
  failureStreak: 0,
  failureThreshold: 10,
  pausedAt: null,
  pauseReason: null,
  tokenHash: "hash",
  tokenCipher: null,
  tokenPreview: "preview",
  expiryMode: "indeterminate" as const,
  expiresAt: null,
  lastUsedAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  updatedByProfileId: "profile-1",
  createdAt: new Date(),
  updatedAt: new Date(),
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository", () => ({
  teamWebhookRepository: {
    countInboundWithCtx: countInboundWithCtxMock,
    countOutboundWithCtx: mock(async () => 0),
    createWithCtx: createWithCtxMock,
  },
  TeamWebhookRepository: class {},
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookOutboxRepository", () => ({
  teamWebhookOutboxRepository: { cancelPendingForWebhook: mock(async () => {}) },
  TeamWebhookOutboxRepository: class {},
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository", () => ({
  teamWebhookEventLogRepository: { create: mock(async () => {}), list: mock(async () => ({ items: [], total: 0 })) },
  TeamWebhookEventLogRepository: class {},
}));

const { TeamWebhookService } = await import("./TeamWebhookService");

describe("TeamWebhookService.create — limite de webhooks de entrada por time (W23)", () => {
  it("permite criar quando abaixo do teto (10)", async () => {
    countInboundWithCtxMock.mockClear();
    createWithCtxMock.mockClear();
    countInboundWithCtxMock.mockImplementation(async () => 9);

    const service = new TeamWebhookService();
    const result = await service.create(
      { profileId: "profile-1", teamId: "team-1" } as never,
      { direction: "inbound", name: "Novo webhook", tokenMode: "auto", expiryMode: "indeterminate" },
      "https://app.test"
    );

    expect(result.id).toBe("inbound-new");
    expect(createWithCtxMock).toHaveBeenCalledTimes(1);
  });

  it("recusa criar quando no teto (10) — mesma regra do outbound", async () => {
    countInboundWithCtxMock.mockClear();
    createWithCtxMock.mockClear();
    countInboundWithCtxMock.mockImplementation(async () => 10);

    const service = new TeamWebhookService();

    await expect(
      service.create(
        { profileId: "profile-1", teamId: "team-1" } as never,
        { direction: "inbound", name: "Mais um", tokenMode: "auto", expiryMode: "indeterminate" },
        "https://app.test"
      )
    ).rejects.toThrow(/10 webhooks de entrada/);

    expect(createWithCtxMock).not.toHaveBeenCalled();
  });
});
