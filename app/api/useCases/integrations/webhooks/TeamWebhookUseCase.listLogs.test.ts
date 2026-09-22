import { describe, expect, it, mock } from "bun:test";

/**
 * SPEC 10, A-E6 (DA6, W7) — T-10.17: a API de logs (CRUD novo de webhooks)
 * devolve requestPayload/responsePayload mascarados. O `teamWebhookService`
 * continua devolvendo o dado completo (banco); a máscara é responsabilidade
 * do UseCase, no caminho de leitura.
 */
const listLogsMock = mock(async () => ({
  items: [
    {
      id: "log-1",
      teamId: "team-1",
      webhookId: "webhook-1",
      direction: "inbound" as const,
      result: "success" as const,
      eventKey: null,
      method: "POST",
      endpoint: "/api/webhooks/studio/team-1/[token]",
      statusCode: 201,
      requestPayload: { name: "João", email: "joao@example.com", phone: "11999998888" },
      responsePayload: { id: "lead-1" },
      errorMessage: null,
      createdAt: new Date(),
    },
  ],
  total: 1,
  page: 1,
  pageSize: 20,
}));

mock.module("@/app/api/services/teamWebhook/TeamWebhookService", () => ({
  teamWebhookService: {
    listLogs: listLogsMock,
  },
}));

const { TeamWebhookUseCase } = await import("./TeamWebhookUseCase");

describe("TeamWebhookUseCase.listLogs mascara payload sensível na leitura (T-10.17)", () => {
  it("email e phone do requestPayload saem mascarados no Output", async () => {
    const useCase = new TeamWebhookUseCase();
    const output = await useCase.listLogs(
      { profileId: "profile-1", teamId: "team-1" } as never,
      "webhook-1",
      { page: 1, pageSize: 20 }
    );

    expect(output.isValid).toBe(true);
    const items = (output.result as { items: Array<{ requestPayload: { email: string; phone: string } }> }).items;
    expect(items[0]?.requestPayload.email).not.toBe("joao@example.com");
    expect(items[0]?.requestPayload.phone).not.toBe("11999998888");
  });

  it("o retorno do service (o que vai para o banco/já veio do banco) não é mutado", async () => {
    const useCase = new TeamWebhookUseCase();
    await useCase.listLogs({ profileId: "profile-1", teamId: "team-1" } as never, "webhook-1", {
      page: 1,
      pageSize: 20,
    });

    const rawResult = await listLogsMock.mock.results[0]?.value;
    expect((rawResult as { items: Array<{ requestPayload: { email: string } }> }).items[0]?.requestPayload.email).toBe(
      "joao@example.com"
    );
  });
});
