import { describe, expect, it, mock } from "bun:test";
import type { IStudioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";

/**
 * SPEC 10, A-E6 (DA6, W7) — T-10.17 no widget legado: `getLatestWebhookLogs`
 * (tela "Webhook Genérico de Leads") também mascara e-mail/telefone/CNPJ.
 */
mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository", () => ({
  teamWebhookRepository: {
    listInboundByTeamId: mock(async () => []),
    findInboundByTeamId: mock(async () => null),
    touchUsage: mock(async () => {}),
    createWithCtx: mock(async () => ({})),
    updateWithCtx: mock(async () => ({})),
  },
  TeamWebhookRepository: class {},
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookEventLogRepository", () => ({
  teamWebhookEventLogRepository: { create: mock(async () => {}) },
  TeamWebhookEventLogRepository: class {},
}));

mock.module("@/app/api/services/shortLink/ShortLinkService", () => ({
  shortLinkService: { getOrCreate: mock(async () => "https://short.test/x") },
}));

mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: { createLead: mock(async () => { throw new Error("não usado"); }) },
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
      throw new Error("não usado");
    }),
    touchWebhookLastUsed: mock(async () => {}),
    createWebhookRequestLog: mock(async () => {}),
    listLatestWebhookRequestLogs: mock(async () => ({
      items: [
        {
          id: "log-1",
          teamId: "team-1",
          method: "POST",
          endpoint: "/api/webhooks/studio/team-1/[token]",
          statusCode: 201,
          resultType: "success",
          requestPayload: { name: "Maria", email: "maria@example.com", cnpj: "12.345.678/0001-95" },
          responsePayload: { id: "lead-1" },
          errorMessage: null,
          createdAt: new Date(),
        },
      ],
      total: 1,
    })),
    ...overrides,
  };
}

describe("StudioWebhookIntegrationUseCase.getLatestWebhookLogs mascara payload (T-10.17)", () => {
  it("email e cnpj do requestPayload saem mascarados", async () => {
    const useCase = new StudioWebhookIntegrationUseCase(makeService());

    const output = await useCase.getLatestWebhookLogs({ teamId: "team-1" });

    expect(output.isValid).toBe(true);
    const logs = (output.result as { logs: Array<{ requestPayload: { email: string; cnpj: string } }> }).logs;
    expect(logs[0]?.requestPayload.email).not.toBe("maria@example.com");
    expect(logs[0]?.requestPayload.cnpj).not.toBe("12.345.678/0001-95");
  });
});
