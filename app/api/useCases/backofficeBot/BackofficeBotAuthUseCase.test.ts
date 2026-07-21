import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type AuthServiceResponse =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; error: string };

const verifyCodeMock = mock(async (): Promise<AuthServiceResponse> => ({
  ok: true as const,
  result: { profileId: "profile-1", teamId: "team-1", userLinkId: "link-1" },
}));

const linkInitiateMock = mock(async (): Promise<AuthServiceResponse> => ({
  ok: true as const,
  result: {
    challengeId: "challenge-1",
    code: "123456",
    expiresAt: "2026-07-20T12:10:00.000Z",
    expectedPhone: "+5511999999999",
  },
}));

const sendTextMessageMock = mock(async () => ({}));
const findPrimaryChannelMock = mock(async () => ({
  id: "channel-1",
  displayName: "Bethânia",
}));
const createMessageMock = mock(async () => ({ id: "message-1" }));
const originalConsoleError = console.error;
const consoleErrorMock = mock(() => {});

mock.module("@/app/api/services/backofficeBot/BackofficeBotAuthService", () => ({
  backofficeBotAuthService: {
    verifyCode: verifyCodeMock,
    linkInitiate: linkInitiateMock,
  },
}));

mock.module("@/app/api/services/backofficeBot/evo/BackofficeEvoApiService", () => ({
  backofficeEvoApiService: {
    sendTextMessage: sendTextMessageMock,
  },
}));

mock.module("@/app/api/infra/data/repositories/backofficeBot/BackofficeBotRepository", () => ({
  backofficeBotRepository: {
    findPrimaryChannel: findPrimaryChannelMock,
    createMessage: createMessageMock,
  },
}));

mock.module("@/app/api/services/notifications/NotificationService", () => ({
  notificationService: {
    createSystemNotification: mock(async () => ({})),
  },
}));

mock.module("@/lib/services/EmailService", () => ({
  getEmailService: () => ({
    sendEmailUntracked: mock(async () => ({})),
  }),
}));

const { BackofficeBotAuthUseCase } = await import("./BackofficeBotAuthUseCase");

describe("BackofficeBotAuthUseCase", () => {
  beforeEach(() => {
    console.error = consoleErrorMock as unknown as typeof console.error;
    consoleErrorMock.mockClear();
    verifyCodeMock.mockClear();
    linkInitiateMock.mockClear();
    sendTextMessageMock.mockClear();
    findPrimaryChannelMock.mockClear();
    createMessageMock.mockClear();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  test("linkInitiate retorna challenge no caminho feliz", async () => {
    linkInitiateMock.mockResolvedValueOnce({
      ok: true as const,
      result: {
        challengeId: "challenge-ok",
        code: "654321",
        expiresAt: "2026-07-20T12:10:00.000Z",
        expectedPhone: "+5511888888888",
      },
    });

    const output = await new BackofficeBotAuthUseCase().linkInitiate("profile-1");

    expect(linkInitiateMock).toHaveBeenCalledWith("profile-1");
    expect(output.isValid).toBe(true);
    expect(output.errorMessages).toEqual([]);
    expect(output.result).toEqual({
      challengeId: "challenge-ok",
      code: "654321",
      expiresAt: "2026-07-20T12:10:00.000Z",
      expectedPhone: "+5511888888888",
    });
  });

  test("linkInitiate mapeia RATE_LIMIT com errorCode e correlationId", async () => {
    linkInitiateMock.mockResolvedValueOnce({ ok: false as const, error: "RATE_LIMIT" });

    const output = await new BackofficeBotAuthUseCase().linkInitiate("profile-1");

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual([
      "Limite de geração de código atingido. Tente novamente mais tarde.",
    ]);
    expect(output.result).toMatchObject({ errorCode: "BETHANIA_LINK_RATE_LIMIT" });
    expect((output.result as { correlationId: string }).correlationId).toMatch(/^[a-f0-9]{12}$/);
  });

  test("verifyCode confirma vínculo e envia mensagem WhatsApp", async () => {
    verifyCodeMock.mockResolvedValueOnce({
      ok: true as const,
      result: { profileId: "profile-1", teamId: "team-1", userLinkId: "link-1" },
    });

    const output = await new BackofficeBotAuthUseCase().verifyCode("+5511999999999", "123456");

    expect(verifyCodeMock).toHaveBeenCalledWith("+5511999999999", "123456");
    expect(sendTextMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        instanceName: "bethania",
        number: "+5511999999999",
      })
    );
    expect(createMessageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: "channel-1",
        userLinkId: "link-1",
        direction: "outbound",
      })
    );
    expect(output.isValid).toBe(true);
    expect(output.successMessages).toEqual(["Vínculo confirmado"]);
    expect(output.result).toEqual({
      profileId: "profile-1",
      teamId: "team-1",
      userLinkId: "link-1",
    });
  });

  test("verifyCode mapeia erro de serviço sem enviar confirmação", async () => {
    verifyCodeMock.mockResolvedValueOnce({ ok: false as const, error: "AUTH_INVALID_CODE" });

    const output = await new BackofficeBotAuthUseCase().verifyCode("+5511999999999", "000000");

    expect(output.isValid).toBe(false);
    expect(output.errorMessages).toEqual(["Código incorreto"]);
    expect(output.result).toMatchObject({ errorCode: "BETHANIA_LINK_AUTH_INVALID_CODE" });
    expect(sendTextMessageMock).not.toHaveBeenCalled();
  });

  test("verifyCode não reverte auth quando aviso WhatsApp falha", async () => {
    verifyCodeMock.mockResolvedValueOnce({
      ok: true as const,
      result: { profileId: "profile-1", teamId: "team-1", userLinkId: "link-1" },
    });
    sendTextMessageMock.mockRejectedValueOnce(new Error("Evolution offline"));

    const output = await new BackofficeBotAuthUseCase().verifyCode("+5511999999999", "123456");

    expect(output.isValid).toBe(true);
    expect(output.successMessages).toEqual(["Vínculo confirmado"]);
    expect(createMessageMock).not.toHaveBeenCalled();
  });
});
