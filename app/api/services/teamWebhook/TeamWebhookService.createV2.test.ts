import { beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * SPEC 11 — criação de webhook de entrada v2: versão gravada no webhook (DA1), escopos (DA3), SDRs
 * padrão em rodízio (DA11), link de Meet padrão quando falta Google (DA10), token só gerado e com
 * validade obrigatória (D20, D22).
 */
const SDR_A = "5b1e0ef3-4e8f-4d0b-9b6a-1e2d3c4b5a69";
const SDR_B = "8c2f1a04-5f90-4e1c-8c7b-2f3e4d5c6b7a";

const countInboundWithCtxMock = mock(async () => 0);
const createWithCtxMock = mock(async (_ctx: unknown, data: Record<string, unknown>) => ({
  id: "webhook-v2",
  teamId: "team-1",
  direction: "inbound" as const,
  status: "active" as const,
  name: data.name,
  contractVersion: data.contractVersion ?? 1,
  scopes: (data.scopes as string[] | undefined) ?? ["leads_create"],
  defaultAssigneeProfileIds: (data.defaultAssigneeProfileIds as string[] | undefined) ?? [],
  lastAssignedProfileId: null,
  defaultMeetingLink: (data.defaultMeetingLink as string | null | undefined) ?? null,
  targetUrl: null,
  destinationPreset: null,
  selectedEvents: [],
  failureStreak: 0,
  failureThreshold: 10,
  pausedAt: null,
  pauseReason: null,
  tokenHash: data.tokenHash,
  tokenCipher: data.tokenCipher,
  tokenPreview: data.tokenPreview,
  signingSecretCipher: null,
  signingSecretPreview: null,
  expiryMode: data.expiryMode,
  expiresAt: data.expiresAt,
  lastUsedAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  updatedByProfileId: "profile-1",
  createdAt: new Date(),
  updatedAt: new Date(),
}));

let validSdrIds: string[] = [SDR_A, SDR_B];
let closersWithoutGoogle: Array<{ profileId: string; fullName: string | null }> = [];

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
mock.module("@/app/api/infra/data/repositories/teamMembers/TeamMembersRepository", () => ({
  teamMembersRepository: {
    findActiveSdrProfileIds: mock(async (_teamId: string, ids: string[]) => ids.filter((id) => validSdrIds.includes(id))),
    findActiveClosersWithoutGoogle: mock(async () => closersWithoutGoogle),
  },
  TeamMembersRepository: class {},
}));

const { TeamWebhookService } = await import("./TeamWebhookService");

const access = { profileId: "profile-1", teamId: "team-1" } as never;
const base = {
  direction: "inbound" as const,
  name: "YouPop",
  contractVersion: 2 as const,
  tokenMode: "auto" as const,
  expiryMode: "months_6" as const,
  scopes: ["leads_create", "leads_schedule"] as Array<"leads_create" | "leads_schedule">,
  defaultAssigneeProfileIds: [SDR_A, SDR_B],
};

describe("TeamWebhookService.create — webhook de entrada v2", () => {
  beforeEach(() => {
    validSdrIds = [SDR_A, SDR_B];
    closersWithoutGoogle = [];
    createWithCtxMock.mockClear();
  });

  it("T-11.22: grava versão 2, escopos, SDRs na ordem e devolve a URL /v2/{teamId} sem token na URL", async () => {
    const result = await new TeamWebhookService().create(access, base, "https://www.corretorstudio.com");

    expect(createWithCtxMock.mock.calls[0]?.[1]).toMatchObject({
      contractVersion: 2,
      scopes: ["leads_create", "leads_schedule"],
      defaultAssigneeProfileIds: [SDR_A, SDR_B],
    });
    expect(result.webhookUrl).toBe("https://www.corretorstudio.com/api/webhooks/studio/v2/team-1");
    expect(result.webhookUrl).not.toContain(result.token as string);
    expect(result.contractVersion).toBe(2);
    expect(result.token).toBeDefined();
  });

  it("o token é mostrado uma vez só e fica guardado apenas como hash/cifra", async () => {
    const result = await new TeamWebhookService().create(access, base, "https://app.test");
    const saved = createWithCtxMock.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(JSON.stringify(saved)).not.toContain(result.token as string);
    expect(saved.tokenHash).toBeDefined();
  });

  it("D22: v2 não aceita token manual", async () => {
    await expect(
      new TeamWebhookService().create(access, { ...base, tokenMode: "manual", manualToken: "token-manual-123" }, "https://app.test"),
    ).rejects.toThrow("só token gerado");
  });

  it("D20: v2 exige validade; indeterminado é recusado", async () => {
    await expect(
      new TeamWebhookService().create(access, { ...base, expiryMode: "indeterminate" }, "https://app.test"),
    ).rejects.toThrow("validade");
  });

  it("DA11: exige ao menos um SDR padrão", async () => {
    await expect(
      new TeamWebhookService().create(access, { ...base, defaultAssigneeProfileIds: [] }, "https://app.test"),
    ).rejects.toThrow("SDR");
  });

  it("DA11: recusa SDR que não é SDR ativo do time e SDR repetido", async () => {
    validSdrIds = [SDR_A];
    await expect(new TeamWebhookService().create(access, base, "https://app.test")).rejects.toThrow("SDR");
    validSdrIds = [SDR_A, SDR_B];
    await expect(
      new TeamWebhookService().create(access, { ...base, defaultAssigneeProfileIds: [SDR_A, SDR_A] }, "https://app.test"),
    ).rejects.toThrow("repetido");
  });

  it("DA3: o escopo leads_create é obrigatório e escopo desconhecido é recusado", async () => {
    await expect(
      new TeamWebhookService().create(access, { ...base, scopes: ["leads_schedule"] }, "https://app.test"),
    ).rejects.toThrow("leads_create");
    await expect(
      new TeamWebhookService().create(access, { ...base, scopes: ["leads_create", "admin" as never] }, "https://app.test"),
    ).rejects.toThrow(/escopo/i);
  });

  it("sem escopos informados, nasce só com leads_create", async () => {
    const { scopes: _scopes, ...withoutScopes } = base;
    await new TeamWebhookService().create(access, withoutScopes, "https://app.test");
    expect(createWithCtxMock.mock.calls[0]?.[1]).toMatchObject({ scopes: ["leads_create"] });
  });

  it("T-11.21b: com closer sem Google e sem link de Meet padrão, recusa listando os closers", async () => {
    closersWithoutGoogle = [{ profileId: "c1", fullName: "Ana Lima" }, { profileId: "c2", fullName: "Bia Souza" }];
    await expect(new TeamWebhookService().create(access, base, "https://app.test")).rejects.toThrow(/Ana Lima.*Bia Souza/);
    expect(createWithCtxMock).not.toHaveBeenCalled();
  });

  it("closer sem Google com link de Meet https válido: cria e grava o link", async () => {
    closersWithoutGoogle = [{ profileId: "c1", fullName: "Ana Lima" }];
    await new TeamWebhookService().create(
      access,
      { ...base, defaultMeetingLink: "https://meet.google.com/abc-defg-hij" },
      "https://app.test",
    );
    expect(createWithCtxMock.mock.calls[0]?.[1]).toMatchObject({ defaultMeetingLink: "https://meet.google.com/abc-defg-hij" });
  });

  it("link de Meet padrão só aceita https (nada de http ou javascript:)", async () => {
    for (const link of ["http://meet.google.com/abc", "javascript:void(0)", "meet.google.com/abc"]) {
      await expect(
        new TeamWebhookService().create(access, { ...base, defaultMeetingLink: link }, "https://app.test"),
      ).rejects.toThrow();
    }
  });

  it("todos os closers com Google: o link padrão é opcional", async () => {
    closersWithoutGoogle = [];
    await new TeamWebhookService().create(access, base, "https://app.test");
    expect(createWithCtxMock).toHaveBeenCalledTimes(1);
  });

  it("webhook v1 criado sem os campos novos continua igual (versão 1, URL com token)", async () => {
    const result = await new TeamWebhookService().create(
      access,
      { direction: "inbound", name: "Legado", tokenMode: "auto", expiryMode: "indeterminate" },
      "https://app.test",
    );
    expect(createWithCtxMock.mock.calls[0]?.[1]).not.toHaveProperty("contractVersion");
    expect(result.webhookUrl).toContain("/api/webhooks/studio/team-1/");
  });
});
