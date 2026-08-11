import { beforeEach, describe, expect, it, mock } from "bun:test";

const claimDueMock = mock(async () => [] as Array<{
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
  generation: number;
}>);
const markSentMock = mock(async () => true);
const markFailedWithRetryMock = mock(
  async (
    _id: string,
    _generation: number,
    _attemptCount: number,
    _nextAttemptAt: Date | null,
    _lastError: string
  ) => true
);
const requeueIfProcessingMock = mock(async () => {});
const getBacklogSnapshotMock = mock(async () => ({
  pending: 0,
  processing: 0,
  maxPendingAgeSeconds: null as number | null,
}));

const syncExecuteMock = mock(async (): Promise<{
  isValid: boolean;
  successMessages: string[];
  errorMessages: string[];
  result: { errors: number } | null;
}> => ({
  isValid: true,
  successMessages: [],
  errorMessages: [],
  result: { errors: 0 },
}));

mock.module(
  "@/app/api/infra/data/repositories/emailContactRadarSyncOutbox/EmailContactRadarSyncOutboxRepository",
  () => ({
    emailContactRadarSyncOutboxRepository: {
      claimDue: claimDueMock,
      markSent: markSentMock,
      markFailedWithRetry: markFailedWithRetryMock,
      requeueIfProcessing: requeueIfProcessingMock,
      getBacklogSnapshot: getBacklogSnapshotMock,
    },
  })
);

mock.module("@/app/api/useCases/radar/SyncEmailContactToRadarUseCase", () => ({
  syncEmailContactToRadarUseCase: {
    execute: syncExecuteMock,
  },
}));

const { ProcessEmailContactRadarSyncOutboxUseCase } = await import(
  "./ProcessEmailContactRadarSyncOutboxUseCase"
);

describe("ProcessEmailContactRadarSyncOutboxUseCase", () => {
  beforeEach(() => {
    claimDueMock.mockClear();
    markSentMock.mockClear();
    markFailedWithRetryMock.mockClear();
    requeueIfProcessingMock.mockClear();
    getBacklogSnapshotMock.mockClear();
    syncExecuteMock.mockClear();
    claimDueMock.mockImplementation(async () => []);
    getBacklogSnapshotMock.mockImplementation(async () => ({
      pending: 0,
      processing: 0,
      maxPendingAgeSeconds: null,
    }));
    syncExecuteMock.mockImplementation(async () => ({
      isValid: true,
      successMessages: [],
      errorMessages: [],
      result: { errors: 0 },
    }));
  });

  it("processa lote claimado e marca sent em sucesso", async () => {
    claimDueMock.mockImplementation(async (limit?: number) => {
      expect(limit).toBe(250);
      return [
        {
          id: "outbox-1",
          emailContactId: "contact-1",
          teamId: "team-1",
          emailImportJobId: "job-1",
          attemptCount: 0,
          generation: 0,
        },
      ];
    });
    getBacklogSnapshotMock.mockImplementation(async () => ({
      pending: 40,
      processing: 1,
      maxPendingAgeSeconds: 120,
    }));

    const useCase = new ProcessEmailContactRadarSyncOutboxUseCase();
    const output = await useCase.execute();

    expect(output.isValid).toBe(true);
    expect(syncExecuteMock).toHaveBeenCalledTimes(1);
    expect(markSentMock).toHaveBeenCalledWith("outbox-1", 0);
    expect(getBacklogSnapshotMock).toHaveBeenCalledTimes(1);
    expect(output.result).toMatchObject({
      claimed: 1,
      sent: 1,
      batchSize: 250,
      concurrency: 8,
      theoreticalThroughputPerHour: 12,
      backlog: { pending: 40, processing: 1, maxPendingAgeSeconds: 120 },
    });
  });

  it("falha transitória reenfileira com backoff até o teto, depois marca failed", async () => {
    claimDueMock.mockImplementation(async () => [
      {
        id: "outbox-fail",
        emailContactId: "contact-x",
        teamId: "team-1",
        emailImportJobId: "job-1",
        attemptCount: 4,
        generation: 1,
      },
    ]);
    syncExecuteMock.mockImplementation(async () => ({
      isValid: false,
      successMessages: [],
      errorMessages: ["Radar indisponível"],
      result: null,
    }));

    const useCase = new ProcessEmailContactRadarSyncOutboxUseCase();
    await useCase.execute();

    expect(markFailedWithRetryMock).toHaveBeenCalledTimes(1);
    const failCall = markFailedWithRetryMock.mock.calls[0];
    expect(failCall?.[0]).toBe("outbox-fail");
    expect(failCall?.[1]).toBe(1);
    expect(failCall?.[2]).toBe(5);
    expect(failCall?.[3]).toBeNull();
  });

  it("respeita concorrência máxima ao processar múltiplas linhas", async () => {
    claimDueMock.mockImplementation(async () =>
      Array.from({ length: 12 }, (_, i) => ({
        id: `outbox-${i}`,
        emailContactId: `contact-${i}`,
        teamId: "team-1",
        emailImportJobId: "job-1",
        attemptCount: 0,
        generation: 0,
      }))
    );

    let inFlight = 0;
    let maxInFlight = 0;
    syncExecuteMock.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight -= 1;
      return {
        isValid: true,
        successMessages: [],
        errorMessages: [],
        result: { errors: 0 },
      };
    });

    const useCase = new ProcessEmailContactRadarSyncOutboxUseCase();
    await useCase.execute();

    expect(syncExecuteMock).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBeLessThanOrEqual(8);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
