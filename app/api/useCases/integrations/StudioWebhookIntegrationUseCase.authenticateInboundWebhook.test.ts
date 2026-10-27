import { describe, expect, it, mock } from "bun:test";
import { StudioWebhookTokenExpiryMode } from "@prisma/client";
import type { IStudioWebhookIntegrationService } from "@/app/api/services/StudioWebhookIntegration/IStudioWebhookIntegrationService";

/**
 * SPEC 10, A-E2/DA2 — `authenticateInboundWebhook` resolve autenticação
 * ANTES de qualquer leitura/validação de corpo. T-10.6 depende dele: token
 * inválido não deve nunca chegar ao ponto de gravar log ou validar campo.
 */
const listInboundByTeamIdMock = mock(async (): Promise<unknown[]> => []);

mock.module("@/app/api/infra/data/repositories/teamWebhook/TeamWebhookRepository", () => ({
  teamWebhookRepository: {
    listInboundByTeamId: listInboundByTeamIdMock,
    findInboundByTeamId: mock(async () => null),
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

mock.module("@/app/api/useCases/leads/leadUseCaseFactory", () => ({
  leadUseCase: {
    createLead: mock(async () => {
      throw new Error("não usado neste arquivo de teste");
    }),
  },
}));

mock.module("@/app/api/services/shortLink/ShortLinkService", () => ({
  shortLinkService: {
    getOrCreate: mock(async ({ targetUrl }: { targetUrl: string }) => `https://short.test/${encodeURIComponent(targetUrl)}`),
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

function makeLegacyConfig(overrides: Record<string, unknown> = {}) {
  return {
    id: "legacy-config-1",
    teamId: "team-1",
    tokenHash: "0000000000000000000000000000000000000000000000000000000000000",
    tokenCipher: null,
    tokenPreview: "abcd1234...wxyz",
    expiryMode: StudioWebhookTokenExpiryMode.indeterminate,
    expiresAt: null,
    lastUsedAt: null,
    updatedByProfileId: "profile-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInboundRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "inbound-1",
    teamId: "team-1",
    status: "active",
    tokenHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
    tokenCipher: null,
    tokenPreview: "abcd1234...wxyz",
    expiryMode: StudioWebhookTokenExpiryMode.indeterminate,
    expiresAt: null,
    ...overrides,
  };
}

describe("StudioWebhookIntegrationUseCase.authenticateInboundWebhook (SPEC 10, DA2)", () => {
  it("time inexistente → não autenticado (mesma resposta de token errado)", async () => {
    const service = makeService({ getTeamWithMaster: mock(async () => null) });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.authenticateInboundWebhook({ teamId: "team-x" });

    expect(output.isValid).toBe(false);
    expect((output.result as { authenticated: boolean }).authenticated).toBe(false);
    expect((output.result as { webhookId: string | null }).webhookId).toBeNull();
  });

  it("token sem correspondência → não autenticado, sem webhookId (T-10.6 base)", async () => {
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => [makeInboundRow()]);
    const service = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.authenticateInboundWebhook({ teamId: "team-1", token: "token-errado" });

    expect(output.isValid).toBe(false);
    const result = output.result as { authenticated: boolean; webhookId: string | null };
    expect(result.authenticated).toBe(false);
    expect(result.webhookId).toBeNull();
  });

  it("token correto → autenticado, com webhookId e supabaseId", async () => {
    listInboundByTeamIdMock.mockClear();
    const row = makeInboundRow();
    listInboundByTeamIdMock.mockImplementation(async () => [row]);
    const service = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    // A comparação usa hash — geramos um token cujo hash bate com o hash
    // fixo do fixture via um segundo passo: reaproveitamos o hash real do
    // módulo de segurança para montar um token compatível.
    const { hashStudioWebhookToken } = await import("@/lib/webhooks/studioWebhookSecurity");
    const realToken = "um-token-valido-qualquer-1234567890";
    row.tokenHash = hashStudioWebhookToken(realToken);

    const output = await useCase.authenticateInboundWebhook({ teamId: "team-1", token: realToken });

    expect(output.isValid).toBe(true);
    const result = output.result as { authenticated: boolean; webhookId: string; supabaseId: string };
    expect(result.authenticated).toBe(true);
    expect(result.webhookId).toBe("inbound-1");
    expect(result.supabaseId).toBe("supabase-1");
  });

  it("R10-1: legado expirado + token ERRADO → não autenticado com source null (token é checado antes da expiração)", async () => {
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => []);
    const { hashStudioWebhookToken } = await import("@/lib/webhooks/studioWebhookSecurity");
    const service = makeService({
      getWebhookConfigByTeamId: mock(async () =>
        makeLegacyConfig({
          tokenHash: hashStudioWebhookToken("token-legado-correto"),
          expiresAt: new Date(Date.now() - 60_000),
        })
      ),
    });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.authenticateInboundWebhook({ teamId: "team-1", token: "token-completamente-errado" });

    expect(output.isValid).toBe(false);
    const result = output.result as { authenticated: boolean; source: string | null };
    // Antes da correção, isto retornava source: "legacy" (identidade
    // "resolvida") mesmo com token errado, só porque a config está expirada
    // — vazando a existência da config e pulando o rate limit de bad token.
    expect(result.authenticated).toBe(false);
    expect(result.source).toBeNull();
  });

  it("legado expirado + token CORRETO → não autenticado, mas source 'legacy' (identidade resolvida, TOKEN_EXPIRED)", async () => {
    listInboundByTeamIdMock.mockClear();
    listInboundByTeamIdMock.mockImplementation(async () => []);
    const { hashStudioWebhookToken } = await import("@/lib/webhooks/studioWebhookSecurity");
    const service = makeService({
      getWebhookConfigByTeamId: mock(async () =>
        makeLegacyConfig({
          tokenHash: hashStudioWebhookToken("token-legado-correto"),
          expiresAt: new Date(Date.now() - 60_000),
        })
      ),
    });
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.authenticateInboundWebhook({ teamId: "team-1", token: "token-legado-correto" });

    expect(output.isValid).toBe(false);
    const result = output.result as { authenticated: boolean; source: string | null };
    expect(result.authenticated).toBe(false);
    expect(result.source).toBe("legacy");
  });

  it("R10-8: token vazio/só-espaço (ex.: '%20' na URL) → não autenticado, nunca casa com webhook em modo 'sem token'", async () => {
    listInboundByTeamIdMock.mockClear();
    // Candidato em modo "sem token" existe (dado legado hipotético) — antes
    // da correção, um token normalizado para undefined batia nele.
    listInboundByTeamIdMock.mockImplementation(async () => [
      makeInboundRow({ tokenHash: "0".repeat(64), tokenPreview: "Sem token" }),
    ]);
    const service = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.authenticateInboundWebhook({ teamId: "team-1", token: "   " });

    expect(output.isValid).toBe(false);
    const result = output.result as { authenticated: boolean; webhookId: string | null; source: string | null };
    expect(result.authenticated).toBe(false);
    expect(result.webhookId).toBeNull();
    expect(result.source).toBeNull();
    expect(listInboundByTeamIdMock).not.toHaveBeenCalled();
  });

  it("webhook pausado, mesmo com token correto → não autenticado, mas com webhookId (identidade resolvida)", async () => {
    listInboundByTeamIdMock.mockClear();
    const { hashStudioWebhookToken } = await import("@/lib/webhooks/studioWebhookSecurity");
    const realToken = "outro-token-valido-1234567890";
    const row = makeInboundRow({ status: "paused", tokenHash: hashStudioWebhookToken(realToken) });
    listInboundByTeamIdMock.mockImplementation(async () => [row]);
    const service = makeService();
    const useCase = new StudioWebhookIntegrationUseCase(service);

    const output = await useCase.authenticateInboundWebhook({ teamId: "team-1", token: realToken });

    expect(output.isValid).toBe(false);
    const result = output.result as { authenticated: boolean; webhookId: string | null };
    expect(result.authenticated).toBe(false);
    expect(result.webhookId).toBe("inbound-1");
  });
});
