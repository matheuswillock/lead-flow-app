import { describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

/**
 * SPEC 10, DA4/A-E4 (T-10.12) — PATCH também rejeita tokenMode:none.
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

type UpdateResult = { isValid: boolean; successMessages: string[]; errorMessages: string[]; result: unknown };

const updateMock = mock(async (): Promise<UpdateResult> => {
  throw new Error("não deveria ser chamado com tokenMode=none");
});

mock.module("@/app/api/useCases/integrations/webhooks/TeamWebhookUseCase", () => ({
  teamWebhookUseCase: { update: updateMock },
}));

const { PATCH } = await import("./route");

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/integrations/webhooks/webhook-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/integrations/webhooks/[id] — tokenMode:none é rejeitado (T-10.12)", () => {
  it("tokenMode:none → 400, UseCase não chamado", async () => {
    const response = await PATCH(makeRequest({ tokenMode: "none" }), {
      params: Promise.resolve({ id: "webhook-1" }),
    });
    if (!response) throw new Error("PATCH não retornou resposta");

    expect(response.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
