import { describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

/**
 * SPEC 10, DA4/A-E4 (T-10.12) — o modo "none" ("Sem token") também saiu da
 * API de criação/edição do CRUD novo (`app/api/v1/integrations/webhooks`),
 * não só do widget legado.
 */
const teamAccessMock = mock(async () => ({
  access: {
    profileId: "profile-1",
    teamId: "team-1",
    teamMember: { role: "manager", functions: [] },
  },
}));

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: teamAccessMock,
}));

type CreateResult = { isValid: boolean; successMessages: string[]; errorMessages: string[]; result: unknown };

const createMock = mock(async (): Promise<CreateResult> => {
  throw new Error("não deveria ser chamado com tokenMode=none");
});

mock.module("@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase", () => ({
  teamWebhookUseCase: { create: createMock },
}));

const { POST } = await import("./route");

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/integrations/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/integrations/webhooks — tokenMode:none é rejeitado (T-10.12)", () => {
  it("tokenMode:none → 400, UseCase não chamado", async () => {
    const response = await POST(
      makeRequest({
        direction: "inbound",
        name: "Webhook teste",
        tokenMode: "none",
        expiryMode: "indeterminate",
      })
    );
    if (!response) throw new Error("POST não retornou resposta");

    expect(response.status).toBe(400);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("tokenMode:auto continua aceito", async () => {
    createMock.mockClear();
    createMock.mockImplementationOnce(async () => ({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { id: "wh-1" },
    }));

    const response = await POST(
      makeRequest({
        direction: "inbound",
        name: "Webhook teste",
        tokenMode: "auto",
        expiryMode: "indeterminate",
      })
    );
    if (!response) throw new Error("POST não retornou resposta");

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledTimes(1);
  });
});
