import { describe, expect, it, mock } from "bun:test";
import { StudioWebhookTokenExpiryMode } from "@prisma/client";
import type { IStudioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";

/**
 * SPEC 10, A-E1 (DA1) — o dual-write sai e a rotação com configuração
 * existente exige `confirmRotation`. T-10.3.
 */
const findInboundByTeamIdMock = mock(async (): Promise<unknown | null> => null);
const createWithCtxMock = mock(async (ctx: unknown, data: Record<string, unknown>) => ({
  id: "inbound-new",
  teamId: "team-1",
  tokenHash: data.tokenHash,
  tokenCipher: data.tokenCipher,
  tokenPreview: data.tokenPreview,
  expiryMode: data.expiryMode,
  expiresAt: data.expiresAt ?? null,
  lastUsedAt: null,
}));
const updateWithCtxMock = mock(async (ctx: unknown, id: string, data: Record<string, unknown>) => ({
  id,
  teamId: "team-1",
  tokenHash: data.tokenHash,
  tokenCipher: data.tokenCipher,
  tokenPreview: data.tokenPreview,
  expiryMode: data.expiryMode,
  expiresAt: data.expiresAt ?? null,
  lastUsedAt: null,
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository", () => ({
  teamWebhookRepository: {
    findInboundByTeamId: findInboundByTeamIdMock,
    listInboundByTeamId: mock(async () => []),
    touchUsage: mock(async () => {}),
    createWithCtx: createWithCtxMock,
    updateWithCtx: updateWithCtxMock,
  },
  TeamWebhookRepository: class {},
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository", () => ({
  teamWebhookEventLogRepository: {
    create: mock(async () => {}),
  },
  TeamWebhookEventLogRepository: class {},
}));

mock.module("@/app/api/services/shortLink/ShortLinkService", () => ({
  shortLinkService: {
    getOrCreate: mock(async ({ targetUrl }: { targetUrl: string }) => `https://short.test/${encodeURIComponent(targetUrl)}`),
  },
}));

mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: {
    createLead: mock(async () => {
      throw new Error("não usado neste arquivo de teste");
    }),
  },
}));

const { StudioWebhookIntegrationUseCase } = await import("./StudioWebhookIntegrationUseCase");

function makeService(overrides: Partial<IStudioWebhookIntegrationService> = {}): IStudioWebhookIntegrationService {
  return {
    getTeamWithMaster: mock(async () => ({
      id: "team-1",
      masterId: "master-1",
      master: { id: "master-1", supabaseId: "supabase-1" },
    })),
    getWebhookConfigByTeamId: mock(async () => null),
    upsertWebhookConfig: mock(async () => {
      throw new Error("upsertConfiguration não deveria mais escrever no legado (dual-write removido)");
    }),
    touchWebhookLastUsed: mock(async () => {}),
    createWebhookRequestLog: mock(async () => {}),
    listLatestWebhookRequestLogs: mock(async () => ({ items: [], total: 0 })),
    ...overrides,
  };
}

function makeInboundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inbound-1",
    teamId: "team-1",
    tokenHash: "old-hash",
    tokenCipher: "v1.iv.tag.old",
    tokenPreview: "oldtoken...wxyz",
    expiryMode: StudioWebhookTokenExpiryMode.indeterminate,
    expiresAt: null,
    lastUsedAt: null,
    ...overrides,
  };
}

describe("StudioWebhookIntegrationUseCase.upsertConfiguration (SPEC 10, DA1)", () => {
  it("T-10.3 — configuração existente sem confirmRotation → 409/rotation_requires_confirmation e token intacto", async () => {
    findInboundByTeamIdMock.mockClear();
    createWithCtxMock.mockClear();
    updateWithCtxMock.mockClear();
    findInboundByTeamIdMock.mockImplementation(async () => makeInboundRow());

    const service = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.upsertConfiguration({
      teamId: "team-1",
      updatedByProfileId: "profile-1",
      tokenMode: "auto",
      expiryMode: "indeterminate",
      appUrl: "https://app.test",
      confirmRotation: false,
    });

    expect(output.isValid).toBe(false);
    expect(output.errorMessages.join(" ")).toContain("rotation_requires_confirmation");
    expect(createWithCtxMock).not.toHaveBeenCalled();
    expect(updateWithCtxMock).not.toHaveBeenCalled();
  });

  it("T-10.3b — configuração existente COM confirmRotation:true → rotaciona normalmente", async () => {
    findInboundByTeamIdMock.mockClear();
    createWithCtxMock.mockClear();
    updateWithCtxMock.mockClear();
    findInboundByTeamIdMock.mockImplementation(async () => makeInboundRow());

    const service = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.upsertConfiguration({
      teamId: "team-1",
      updatedByProfileId: "profile-1",
      tokenMode: "auto",
      expiryMode: "indeterminate",
      appUrl: "https://app.test",
      confirmRotation: true,
    });

    expect(output.isValid).toBe(true);
    expect(updateWithCtxMock).toHaveBeenCalledTimes(1);
    expect(createWithCtxMock).not.toHaveBeenCalled();
  });

  it("sem configuração existente (nem TeamWebhook, nem legado) → cria direto, sem exigir confirmRotation", async () => {
    findInboundByTeamIdMock.mockClear();
    createWithCtxMock.mockClear();
    updateWithCtxMock.mockClear();
    findInboundByTeamIdMock.mockImplementation(async () => null);

    const service = makeService({ getWebhookConfigByTeamId: mock(async () => null) });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.upsertConfiguration({
      teamId: "team-1",
      updatedByProfileId: "profile-1",
      tokenMode: "auto",
      expiryMode: "indeterminate",
      appUrl: "https://app.test",
    });

    expect(output.isValid).toBe(true);
    expect(createWithCtxMock).toHaveBeenCalledTimes(1);
  });

  it("nunca escreve no modelo legado (dual-write removido, W8)", async () => {
    findInboundByTeamIdMock.mockClear();
    createWithCtxMock.mockClear();
    findInboundByTeamIdMock.mockImplementation(async () => null);
    const upsertWebhookConfigMock = mock(async () => {
      throw new Error("não deveria ser chamado");
    });
    const service = makeService({
      getWebhookConfigByTeamId: mock(async () => null),
      upsertWebhookConfig: upsertWebhookConfigMock,
    });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.upsertConfiguration({
      teamId: "team-1",
      updatedByProfileId: "profile-1",
      tokenMode: "auto",
      expiryMode: "indeterminate",
      appUrl: "https://app.test",
    });

    expect(output.isValid).toBe(true);
    expect(upsertWebhookConfigMock).not.toHaveBeenCalled();
  });
});
