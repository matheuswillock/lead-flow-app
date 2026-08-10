import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Output } from "@/lib/output";

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
const handleMock = mock(async () => new Output(true, [], [], null));

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

mock.module("@/app/api/useCases/resendWebhook/ResendWebhookUseCase", () => ({
  resendWebhookUseCase: { handle: handleMock },
}));

const { RetryResendWebhookFailuresUseCase } = await import("./RetryResendWebhookFailuresUseCase");

describe("RetryResendWebhookFailuresUseCase (D11)", () => {
  beforeEach(() => {
    claimDueMock.mockClear();
    markResolvedMock.mockClear();
    markRetryOrFailedMock.mockClear();
    requeueIfProcessingMock.mockClear();
    handleMock.mockClear();
    claimDueMock.mockImplementation(async () => []);
    handleMock.mockImplementation(async () => new Output(true, [], [], null));
    markRetryOrFailedMock.mockImplementation(async () => "retried");
  });

  it("marca resolved quando reprocessamento tem sucesso", async () => {
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
    expect(handleMock).toHaveBeenCalledTimes(1);
    expect(markResolvedMock).toHaveBeenCalledWith("row-1");
    expect(markRetryOrFailedMock).not.toHaveBeenCalled();
  });

  it("reenfileira após falha transitória", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-2",
        svixId: "svix-2",
        eventType: "email.delivered",
        payload: { type: "email.delivered" },
        attemptCount: 2,
      },
    ]);
    handleMock.mockImplementation(async () => {
      throw new Error("timeout de pool");
    });
    markRetryOrFailedMock.mockImplementation(async () => "retried");

    const useCase = new RetryResendWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-2", 3, "timeout de pool");
  });

  it("marca failed após esgotar tentativas", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-3",
        svixId: "svix-3",
        eventType: "email.bounced",
        payload: { type: "email.bounced" },
        attemptCount: 5,
      },
    ]);
    handleMock.mockImplementation(async () => {
      throw new Error("erro permanente");
    });
    markRetryOrFailedMock.mockImplementation(async () => "failed");

    const useCase = new RetryResendWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-3", 6, "erro permanente");
  });
});
