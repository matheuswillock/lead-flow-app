import { describe, expect, it, mock } from "bun:test";
import { NextRequest } from "next/server";

/**
 * SPEC 10, DA4/V13 (T-10.14) — o token manual do legado passa a exigir 32
 * caracteres no mínimo (antes eram 8). R10-4 (revisão Opus): faltava um
 * teste nomeado para esta validação, embora o schema já a implementasse.
 */
const teamAccessMock = mock(async () => ({
  access: {
    profileId: "profile-1",
    teamId: "11111111-1111-4111-8111-111111111111",
    teamMember: { role: "manager", functions: [] },
  },
}));

mock.module("@/app/api/v1/utils/teamAccess", () => ({
  getTeamAccess: teamAccessMock,
}));

type UpsertResult = { isValid: boolean; successMessages: string[]; errorMessages: string[]; result: unknown };

const upsertConfigurationMock = mock(async (): Promise<UpsertResult> => {
  throw new Error("não deveria ser chamado com manualToken curto");
});

mock.module("@/app/api/useCases/integrations/StudioWebhookIntegrationUseCase", () => ({
  studioWebhookIntegrationUseCase: { upsertConfiguration: upsertConfigurationMock },
  studioWebhookErrors: { ROTATION_REQUIRES_CONFIRMATION_ERROR: "rotation_requires_confirmation" },
}));

const { PUT } = await import("./route");

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/v1/integrations/studio-webhook", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/v1/integrations/studio-webhook — manualToken exige 32+ caracteres (T-10.14)", () => {
  it("31 caracteres → 400, UseCase não chamado", async () => {
    const response = await PUT(
      makeRequest({
        tokenMode: "manual",
        manualToken: "a".repeat(31),
        expiryMode: "indeterminate",
      })
    );

    expect(response.status).toBe(400);
    expect(upsertConfigurationMock).not.toHaveBeenCalled();
  });

  it("32 caracteres → passa da validação de schema (chega a chamar o UseCase)", async () => {
    upsertConfigurationMock.mockClear();
    upsertConfigurationMock.mockImplementationOnce(async () => ({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { tokenMode: "manual" },
    }));

    const response = await PUT(
      makeRequest({
        tokenMode: "manual",
        manualToken: "a".repeat(32),
        expiryMode: "indeterminate",
      })
    );

    expect(response.status).toBe(200);
    expect(upsertConfigurationMock).toHaveBeenCalledTimes(1);
  });
});
