import { describe, expect, it, mock } from "bun:test";
import { StudioWebhookTokenExpiryMode } from "@prisma/client";
import { Output } from "@/lib/output";
import type { IStudioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";
import type { ProcessStudioWebhookLeadInput } from "./IStudioWebhookIntegrationUseCase";

const createLeadMock = mock(async () =>
  new Output(true, [], [], { id: "lead-1", leadCode: "T1234A" })
);

const listInboundByTeamIdMock = mock(async (): Promise<unknown[]> => []);
const touchUsageMock = mock(async () => {});

mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: {
    createLead: createLeadMock,
  },
}));

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository", () => ({
  teamWebhookRepository: {
    listInboundByTeamId: listInboundByTeamIdMock,
    findInboundByTeamId: mock(async () => null),
    touchUsage: touchUsageMock,
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

function makeInboundNoTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inbound-1",
    teamId: "team-1",
    direction: "inbound",
    status: "active",
    name: "Webhook Genérico de Leads",
    targetUrl: null,
    destinationPreset: null,
    selectedEvents: [],
    failureStreak: 0,
    failureThreshold: 10,
    pausedAt: null,
    pauseReason: null,
    tokenHash: "ignored-by-preview",
    tokenCipher: null,
    tokenPreview: "Sem token",
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

describe("StudioWebhookIntegrationUseCase.processWebhookLead (D2)", () => {
  it("cria o lead via leadUseCase.createLead com originChannel e confirmDuplicate", async () => {
    createLeadMock.mockClear();
    touchUsageMock.mockClear();
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => []);
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
    touchUsageMock.mockClear();
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => []);
    createLeadMock.mockImplementationOnce(async () => new Output(false, [], ["duplicado"], null));
    const { service, touchWebhookLastUsed } = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(false);
    expect(touchWebhookLastUsed).not.toHaveBeenCalled();
  });

  it("retorna erro sem chamar createLead quando o master não tem supabaseId", async () => {
    createLeadMock.mockClear();
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => []);
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

  it("SPEC 11 DA1/T-11.1: contrato v1 congelado — corrida de índice único (e-mail) devolve result: null mesmo com isDuplicateConflict/existingLeadId no LeadUseCase (SPEC 40 D25)", async () => {
    // `LeadUseCase.createLead` passou a devolver `isDuplicateConflict` e
    // `existingLeadId` no `result` de erro (SPEC 40 D25), para o formulário
    // público resolver o lead que recebe a atividade de duplicata. Nesse
    // caminho específico (corrida de índice único) o `result` já era `null`
    // antes da SPEC 40 — o webhook v1 (contrato congelado, SPEC 11 DA1)
    // precisa continuar recebendo `null` aqui.
    createLeadMock.mockClear();
    touchUsageMock.mockClear();
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => []);
    createLeadMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Ja existe um lead com este e-mail"], {
        isDuplicateConflict: true,
        existingLeadId: "lead-existente-1",
      })
    );
    const { service } = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Ja existe um lead com este e-mail"]);
    // O ponto central do teste: nada de `isDuplicateConflict`/`existingLeadId`
    // vaza para o contrato v1 do webhook.
    expect(output.result).toBeNull();
  });

  it("R40-20: contrato v1 preserva requiresDuplicateConfirmation/duplicateCandidates do pre-check, removendo só os campos novos do D25", async () => {
    // Antes da SPEC 40 (origin/develop), o pre-check de telefone/e-mail
    // duplicado em `LeadUseCase.ts` já devolvia
    // `{ requiresDuplicateConfirmation: true, duplicateCandidates: [...] }`
    // no `result` de erro, e `handleStudioWebhookLeadRequest.ts` serializa
    // esse `result` inteiro na resposta do webhook. `restoreV1LeadErrorContract`
    // MUST remover só os dois campos novos do D25 (`isDuplicateConflict`,
    // `existingLeadId`) — nunca o `result` inteiro — para não quebrar o
    // contrato v1 no sentido oposto (achado R40-20 da revisão).
    createLeadMock.mockClear();
    touchUsageMock.mockClear();
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => []);
    const duplicateCandidates = [
      { id: "lead-candidato-1", leadCode: "T0001A", name: "Cliente Existente" },
    ];
    createLeadMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Possível lead duplicado neste time"], {
        requiresDuplicateConfirmation: true,
        existingLeadId: "lead-candidato-1",
        duplicateCandidates,
      })
    );
    const { service } = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Possível lead duplicado neste time"]);
    // Preserva o formato pré-SPEC-40 exatamente — sem existingLeadId.
    expect(output.result).toEqual({
      requiresDuplicateConfirmation: true,
      duplicateCandidates,
    });
  });

  it("usa TeamWebhook inbound ativo e grava touchUsage no webhook unificado", async () => {
    createLeadMock.mockClear();
    touchUsageMock.mockClear();
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => [makeInboundNoTokenRow()]);
    createLeadMock.mockImplementation(async () =>
      new Output(true, [], [], { id: "lead-2", leadCode: "T9999Z" })
    );

    const { service, touchWebhookLastUsed } = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(true);
    expect(createLeadMock).toHaveBeenCalledTimes(1);
    expect(touchUsageMock).toHaveBeenCalledWith("inbound-1", true);
    expect(touchWebhookLastUsed).toHaveBeenCalledTimes(1);
    expect((output.result as { webhookId?: string }).webhookId).toBe("inbound-1");
  });

  it("SPEC 11 DA1/T-11.1: contrato v1 congelado no caminho de TeamWebhook inbound — mesmo tratamento do legado", async () => {
    createLeadMock.mockClear();
    touchUsageMock.mockClear();
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => [makeInboundNoTokenRow()]);
    createLeadMock.mockImplementationOnce(async () =>
      new Output(false, [], ["Já existe um lead com este CNPJ neste time (T1234A)"], {
        isDuplicateConflict: true,
        existingLeadId: "lead-existente-2",
      })
    );

    const { service } = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.processWebhookLead(makeInput());

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Já existe um lead com este CNPJ neste time (T1234A)"]);
    expect(output.result).toBeNull();
    expect(touchUsageMock).not.toHaveBeenCalled();
  });
});
