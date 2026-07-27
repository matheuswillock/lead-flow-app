import { describe, expect, it, mock } from "bun:test";
import { StudioWebhookTokenExpiryMode } from "@prisma/client";
import { Output } from "@/lib/output";
import type { IStudioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";
import type { ProcessStudioWebhookLeadInput } from "./IStudioWebhookIntegrationUseCase";

const createLeadMock = mock(async () =>
  new Output(true, [], [], { id: "lead-1", leadCode: "T1234A" })
);

mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: {
    createLead: createLeadMock,
  },
}));

const { StudioWebhookIntegrationUseCase } = await import("./StudioWebhookIntegrationUseCase");

function makeService(overrides: Partial<IStudioWebhookIntegrationService> = {}): {
  service: IStudioWebhookIntegrationService;
  touchWebhookLastUsed: ReturnType<typeof mock>;
} {
  const touchWebhookLastUsed = mock(async () => {});
  const service: IStudioWebhookIntegrationService = {
    getTeamWithMaster: mock(async () => ({
      id: "team-1",
      masterId: "master-1",
      master: { id: "master-1", supabaseId: "supabase-1" },
    })),
    getWebhookConfigByTeamId: mock(async () => ({
      id: "config-1",
      teamId: "team-1",
      tokenHash: "hash",
      tokenCipher: null,
      tokenPreview: "Sem token",
      expiryMode: StudioWebhookTokenExpiryMode.indeterminate,
      expiresAt: null,
      lastUsedAt: null,
      updatedByProfileId: "profile-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    upsertWebhookConfig: mock(async () => {
      throw new Error("not used in this test");
    }),
    touchWebhookLastUsed,
    createWebhookRequestLog: mock(async () => {}),
    listLatestWebhookRequestLogs: mock(async () => []),
    ...overrides,
  };
  return { service, touchWebhookLastUsed };
}

function makeInput(overrides: Partial<ProcessStudioWebhookLeadInput> = {}): ProcessStudioWebhookLeadInput {
  return {
    teamId: "team-1",
    payload: { name: "Lead Studio", email: "lead@example.com" },
    ...overrides,
  };
}

describe("StudioWebhookIntegrationUseCase.processWebhookLead (D2)", () => {
  it("cria o lead via leadUseCase.createLead com originChannel e confirmDuplicate", async () => {
    createLeadMock.mockClear();
    const { service, touchWebhookLastUsed } = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(true);
    expect(createLeadMock).toHaveBeenCalledTimes(1);
    const [supabaseId, data, teamId] = createLeadMock.mock.calls[0] as unknown[];
    expect(supabaseId).toBe("supabase-1");
    expect(teamId).toBe("team-1");
    expect((data as { originChannel?: string }).originChannel).toBe("studio_webhook");
    expect((data as { confirmDuplicate?: boolean }).confirmDuplicate).toBe(true);
    expect(touchWebhookLastUsed).toHaveBeenCalledTimes(1);
  });

  it("não chama touchWebhookLastUsed quando createLead falha", async () => {
    createLeadMock.mockClear();
    createLeadMock.mockImplementationOnce(async () => new Output(false, [], ["duplicado"], null));
    const { service, touchWebhookLastUsed } = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(false);
    expect(touchWebhookLastUsed).not.toHaveBeenCalled();
  });

  it("retorna erro sem chamar createLead quando o master não tem supabaseId", async () => {
    createLeadMock.mockClear();
    const { service } = makeService({
      getTeamWithMaster: mock(async () => ({
        id: "team-1",
        masterId: "master-1",
        master: { id: "master-1", supabaseId: null },
      })),
    });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(false);
    expect(createLeadMock).not.toHaveBeenCalled();
  });
});
