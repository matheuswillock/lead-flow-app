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
const publishAsaasWebhookEventMock = mock(async () => ({ messageId: "msg-1" }));

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

mock.module("@/lib/queues/asaas-webhook-events", () => ({
  publishAsaasWebhookEvent: publishAsaasWebhookEventMock,
}));

const { RetryAsaasWebhookFailuresUseCase } = await import("./RetryAsaasWebhookFailuresUseCase");

describe("RetryAsaasWebhookFailuresUseCase (republish-to-queue)", () => {
  beforeEach(() => {
    claimDueMock.mockClear();
    markProcessedMock.mockClear();
    markRetryOrFailedMock.mockClear();
    requeueIfProcessingMock.mockClear();
    publishAsaasWebhookEventMock.mockClear();
    claimDueMock.mockImplementation(async () => []);
    publishAsaasWebhookEventMock.mockImplementation(async () => ({ messageId: "msg-1" }));
    markRetryOrFailedMock.mockImplementation(async () => "retried");
  });

  it("republica na fila e marca processed quando o publish tem sucesso", async () => {
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
    expect(publishAsaasWebhookEventMock).toHaveBeenCalledTimes(1);
    expect(publishAsaasWebhookEventMock).toHaveBeenCalledWith({
      eventId: "row-1",
      body: { event: "PAYMENT_RECEIVED" },
    });
    expect(markProcessedMock).toHaveBeenCalledWith("row-1");
    expect(markRetryOrFailedMock).not.toHaveBeenCalled();
    expect(result.result).toMatchObject({ claimed: 1, resolved: 1, retried: 0, failed: 0 });
  });

  it("não chama processamento de negócio direto — só publica na fila", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-1",
        eventType: "PAYMENT_RECEIVED",
        payload: { event: "PAYMENT_RECEIVED" },
        attemptCount: 1,
      },
    ]);

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    await useCase.execute();

    expect(publishAsaasWebhookEventMock).toHaveBeenCalledTimes(1);
  });

  it("reenfileira após as 3 tentativas de publish falharem", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-2",
        eventType: "PAYMENT_CONFIRMED",
        payload: { event: "PAYMENT_CONFIRMED" },
        attemptCount: 2,
      },
    ]);
    publishAsaasWebhookEventMock.mockImplementation(async () => {
      throw new Error("timeout de rede");
    });
    markRetryOrFailedMock.mockImplementation(async () => "retried");

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-2", 3, expect.any(String));
    expect(markProcessedMock).not.toHaveBeenCalled();
    expect(result.result).toMatchObject({ claimed: 1, resolved: 0, retried: 1, failed: 0 });
  });

  it("marca failed após esgotar tentativas de publish", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "row-3",
        eventType: "PAYMENT_OVERDUE",
        payload: { event: "PAYMENT_OVERDUE" },
        attemptCount: 5,
      },
    ]);
    publishAsaasWebhookEventMock.mockImplementation(async () => {
      throw new Error("erro permanente");
    });
    markRetryOrFailedMock.mockImplementation(async () => "failed");

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(markRetryOrFailedMock).toHaveBeenCalledWith("row-3", 6, expect.any(String));
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

  it("processa múltiplas linhas em paralelo (chunks de concorrência)", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `row-${i}`,
      eventType: "PAYMENT_RECEIVED",
      payload: { event: "PAYMENT_RECEIVED" },
      attemptCount: 1,
    }));
    claimDueMock.mockImplementation(async () => rows);

    const useCase = new RetryAsaasWebhookFailuresUseCase();
    const result = await useCase.execute();

    expect(result.isValid).toBe(true);
    expect(publishAsaasWebhookEventMock).toHaveBeenCalledTimes(5);
    expect(markProcessedMock).toHaveBeenCalledTimes(5);
  });
});
