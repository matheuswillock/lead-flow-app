import { beforeEach, describe, expect, it, mock } from "bun:test";

const claimDueMock = mock(async () => [] as Array<{
  id: string;
  svixId: string;
  eventType: string;
  payload: { type: string };
  attemptCount: number;
}>);
const markResolvedMock = mock(async () => {});
const markRetryOrFailedMock = mock(
  async (): Promise<"retried" | "failed"> => "retried"
);
const requeueIfProcessingMock = mock(async () => {});
const publishResendWebhookEmailLogEventMock = mock(async () => ({ messageId: "msg-1" }));

mock.module(
  "@/app/api/infra/data/repositories/resendWebhookProcessingFailure/ResendWebhookProcessingFailureRepository",
  () => ({
    resendWebhookProcessingFailureRepository: {
      claimDue: claimDueMock,
      markResolved: markResolvedMock,
      markRetryOrFailed: markRetryOrFailedMock,
      requeueIfProcessing: requeueIfProcessingMock,
    },
    formatProcessingError: (error: unknown) =>
      error instanceof Error ? error.message : String(error),
  })
);

mock.module("@/lib/queues/resend-webhook-emaillog-events", () => ({
  publishResendWebhookEmailLogEvent: publishResendWebhookEmailLogEventMock,
}));

const { RetryResendWebhookFailuresUseCase } = await import("./RetryResendWebhookFailuresUseCase");

describe("RetryResendWebhookFailuresUseCase (D11 + republish-to-queue)", () => {
  beforeEach(() => {
    claimDueMock.mockClear();
    markResolvedMock.mockClear();
    markRetryOrFailedMock.mockClear();
    requeueIfProcessingMock.mockClear();
    publishResendWebhookEmailLogEventMock.mockClear();
    claimDueMock.mockImplementation(async () => []);
    publishResendWebhookEmailLogEventMock.mockImplementation(async () => ({ messageId: "msg-1" }));
    markRetryOrFailedMock.mockImplementation(async () => "retried");
  });

  it("republica na fila e marca resolved quando o publish tem sucesso", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-1",
        svixId: "svix-1",
        eventType: "email.sent",
        payload: { type: "email.sent" },
        attemptCount: 1,
      },
    ]);

    const useCase = new RetryResendWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(publishResendWebhookEmailLogEventMock).toHaveBeenCalledTimes(1);
    expect(publishResendWebhookEmailLogEventMock).toHaveBeenCalledWith({
      event: { type: "email.sent" },
      svixId: "svix-1",
    });
    expect(markResolvedMock).toHaveBeenCalledWith("row-1");
    expect(markRetryOrFailedMock).not.toHaveBeenCalled();
  });

  it("não chama processamento de negócio direto — só publica na fila", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-1",
        svixId: "svix-1",
        eventType: "email.sent",
        payload: { type: "email.sent" },
        attemptCount: 1,
      },
    ]);

    const useCase = new RetryResendWebhookFailuresUseCase();
    await useCase.execute();

    expect(publishResendWebhookEmailLogEventMock).toHaveBeenCalledTimes(1);
  });

  it("reenfileira no outbox após as 3 tentativas de publish falharem", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-2",
        svixId: "svix-2",
        eventType: "email.delivered",
        payload: { type: "email.delivered" },
        attemptCount: 2,
      },
    ]);
    publishResendWebhookEmailLogEventMock.mockImplementation(async () => {
      throw new Error("timeout de rede");
    });
    markRetryOrFailedMock.mockImplementation(async () => "retried");

    const useCase = new RetryResendWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-2", 3, expect.any(String));
    expect(markResolvedMock).not.toHaveBeenCalled();
  });

  it("marca failed após esgotar tentativas de publish", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-3",
        svixId: "svix-3",
        eventType: "email.bounced",
        payload: { type: "email.bounced" },
        attemptCount: 5,
      },
    ]);
    publishResendWebhookEmailLogEventMock.mockImplementation(async () => {
      throw new Error("erro permanente");
    });
    markRetryOrFailedMock.mockImplementation(async () => "failed");

    const useCase = new RetryResendWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-3", 6, expect.any(String));
  });

  it("processa múltiplas linhas em paralelo (chunks de concorrência)", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `row-${i}`,
      svixId: `svix-${i}`,
      eventType: "email.opened",
      payload: { type: "email.opened" },
      attemptCount: 1,
    }));
    claimDueMock.mockImplementation(async () => rows);

    const useCase = new RetryResendWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(publishResendWebhookEmailLogEventMock).toHaveBeenCalledTimes(5);
    expect(markResolvedMock).toHaveBeenCalledTimes(5);
  });
});
