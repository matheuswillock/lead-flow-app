import { describe, expect, it, mock } from "bun:test";
import { StudioWebhookTokenExpiryMode } from "@prisma/client";
import type { IStudioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";

/**
 * SPEC 10, A-E1 (DA1) — `getConfiguration` lê `TeamWebhook` primeiro e só
 * cai no legado quando não existe nenhum inbound. T-10.1 e T-10.2.
 */
const findInboundByTeamIdMock = mock(async (): Promise<unknown | null> => null);

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository", () => ({
  teamWebhookRepository: {
    findInboundByTeamId: findInboundByTeamIdMock,
    listInboundByTeamId: mock(async () => []),
    touchUsage: mock(async () => {}),
    createWithCtx: mock(async () => ({})),
    updateWithCtx: mock(async () => ({})),
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
      throw new Error("not used in this test");
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
    direction: "inbound",
    status: "active",
    name: "Webhook Genérico de Leads",
    contractVersion: 1,
    targetUrl: null,
    destinationPreset: null,
    selectedEvents: [],
    failureStreak: 0,
    failureThreshold: 10,
    pausedAt: null,
    pauseReason: null,
    tokenHash: "hash-abc",
    tokenCipher: null,
    tokenPreview: "abcd1234...wxyz",
    expiryMode: StudioWebhookTokenExpiryMode.indeterminate,
    expiresAt: null,
    lastUsedAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    updatedByProfileId: "profile-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("StudioWebhookIntegrationUseCase.getConfiguration (SPEC 10, DA1)", () => {
  it("T-10.1 — time com TeamWebhook ativo e sem linha legada → configured:true com o tokenPreview do TeamWebhook", async () => {
    findInboundByTeamIdMock.mockClear();
    findInboundByTeamIdMock.mockImplementation(async () => makeInboundRow());

    const legacyMock = mock(async () => {
      throw new Error("getConfiguration não deveria consultar o legado quando existe TeamWebhook inbound");
    });
    const service = makeService({ getWebhookConfigByTeamId: legacyMock });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.getConfiguration({ teamId: "team-1", appUrl: "https://app.test" });

    expect(output.isValid).toBe(true);
    expect((output.result as { configured: boolean }).configured).toBe(true);
    expect((output.result as { tokenPreview: string }).tokenPreview).toBe("abcd1234...wxyz");
    expect(legacyMock).not.toHaveBeenCalled();
  });

  it("T-10.2 — time só com linha legada (sem TeamWebhook inbound) → fallback de leitura funciona", async () => {
    findInboundByTeamIdMock.mockClear();
    findInboundByTeamIdMock.mockImplementation(async () => null);

    const legacyConfig = {
      id: "legacy-1",
      teamId: "team-1",
      tokenHash: "legacy-hash",
      tokenCipher: null,
      tokenPreview: "Sem token",
      expiryMode: StudioWebhookTokenExpiryMode.indeterminate,
      expiresAt: null,
      lastUsedAt: null,
      updatedByProfileId: "profile-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const service = makeService({ getWebhookConfigByTeamId: mock(async () => legacyConfig) });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.getConfiguration({ teamId: "team-1", appUrl: "https://app.test" });

    expect(output.isValid).toBe(true);
    expect((output.result as { configured: boolean }).configured).toBe(true);
    expect((output.result as { tokenPreview: string }).tokenPreview).toBe("Sem token");
  });
});
