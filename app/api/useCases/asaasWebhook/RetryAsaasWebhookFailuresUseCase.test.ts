import { beforeEach, describe, expect, it, mock } from "bun:test";

const claimDueMock = mock(async () => [] as Array<{
  id: string;
  eventType: string | null;
  payload: { event: string };
  attemptCount: number;
}>);
const markProcessedMock = mock(async () => {});
const markRetryOrFailedMock = mock(
  async (): Promise<"retried" | "failed"> => "retried"
);
const requeueIfProcessingMock = mock(async () => {});
const processAsaasWebhookEventMock = mock(async () => {});

mock.module(
  "@/app/api/infra/data/repositories/asaasWebhook/AsaasWebhookEventRepository",
  () => ({
    asaasWebhookEventRepository: {
      claimDue: claimDueMock,
      markProcessed: markProcessedMock,
      markRetryOrFailed: markRetryOrFailedMock,
      requeueIfProcessing: requeueIfProcessingMock,
    },
  })
);

mock.module("@/app/api/webhooks/asaas/processAsaasWebhookEvent", () => ({
  processAsaasWebhookEvent: processAsaasWebhookEventMock,
}));

const { RetryAsaasWebhookFailuresUseCase } = await import("./RetryAsaasWebhookFailuresUseCase");

describe("RetryAsaasWebhookFailuresUseCase", () => {
  beforeEach(() => {
    claimDueMock.mockClear();
    markProcessedMock.mockClear();
    markRetryOrFailedMock.mockClear();
    requeueIfProcessingMock.mockClear();
    processAsaasWebhookEventMock.mockClear();
    claimDueMock.mockImplementation(async () => []);
    processAsaasWebhookEventMock.mockImplementation(async () => {});
    markRetryOrFailedMock.mockImplementation(async () => "retried");
  });

  it("marca processed quando reprocessamento tem sucesso", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-1",
        eventType: "PAYMENT_RECEIVED",
        payload: { event: "PAYMENT_RECEIVED" },
        attemptCount: 1,
      },
    ]);

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(processAsaasWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(markProcessedMock).toHaveBeenCalledWith("row-1");
    expect(markRetryOrFailedMock).not.toHaveBeenCalled();
    expect(result.result).toMatchObject({ claimed: 1, resolved: 1, retried: 0, failed: 0 });
  });

  it("reenfileira após falha transitória", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-2",
        eventType: "PAYMENT_CONFIRMED",
        payload: { event: "PAYMENT_CONFIRMED" },
        attemptCount: 2,
      },
    ]);
    processAsaasWebhookEventMock.mockImplementation(async () => {
      throw new Error("timeout de pool");
    });
    markRetryOrFailedMock.mockImplementation(async () => "retried");

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-2", 3, "timeout de pool");
    expect(markProcessedMock).not.toHaveBeenCalled();
    expect(result.result).toMatchObject({ claimed: 1, resolved: 0, retried: 1, failed: 0 });
  });

  it("marca failed após esgotar tentativas", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-3",
        eventType: "PAYMENT_OVERDUE",
        payload: { event: "PAYMENT_OVERDUE" },
        attemptCount: 5,
      },
    ]);
    processAsaasWebhookEventMock.mockImplementation(async () => {
      throw new Error("erro permanente");
    });
    markRetryOrFailedMock.mockImplementation(async () => "failed");

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-3", 6, "erro permanente");
    expect(markProcessedMock).not.toHaveBeenCalled();
    expect(result.result).toMatchObject({ claimed: 1, resolved: 0, retried: 0, failed: 1 });
  });

  it("reenfileira o lote e retorna Output inválido quando claimDue falha", async () => {
    claimDueMock.mockImplementation(async () => {
      throw new Error("falha no claim");
    });

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(false);
    expect(result.errorMessages).toEqual(["Erro ao reprocessar falhas do webhook Asaas"]);
    expect(requeueIfProcessingMock).toHaveBeenCalledWith([]);
    expect(markProcessedMock).not.toHaveBeenCalled();
    expect(markRetryOrFailedMock).not.toHaveBeenCalled();
  });
});
