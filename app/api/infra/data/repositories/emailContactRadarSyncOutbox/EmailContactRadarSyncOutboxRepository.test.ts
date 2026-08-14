import { beforeEach, describe, expect, it, mock } from "bun:test";

const upsertMock = mock(
  async (_args: {
    where: { emailContactId: string };
    create: { status: string; attemptCount: number; emailImportJobId: string };
    update: {
      status: string;
      attemptCount: number;
      emailImportJobId: string;
      lastError: null;
      generation: { increment: number };
    };
  }) => ({})
);
const findManyMock = mock(async () => [] as Array<{
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
  generation: number;
}>);
const updateManyMock = mock(async (_args?: {
  where?: { id?: string; status?: string; generation?: number };
  data?: { status?: string; attemptCount?: number; generation?: { increment: number } };
}) => ({
  count: 0,
}));
const countMock = mock(async (_args?: { where?: { emailImportJobId?: string } }) => 0);
const queryRawMock = mock(async (): Promise<unknown[]> => []);
const publishWake = mock(async () => ({ messageId: "mid-wake" }));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailContactRadarSyncOutbox: {
      upsert: upsertMock,
      findMany: findManyMock,
      updateMany: updateManyMock,
      update: mock(async () => ({})),
      count: countMock,
    },
    $queryRaw: queryRawMock,
  },
}));

const { EmailContactRadarSyncOutboxRepository } = await import(
  "./EmailContactRadarSyncOutboxRepository"
);

describe("EmailContactRadarSyncOutboxRepository", () => {
  beforeEach(() => {
    upsertMock.mockClear();
    findManyMock.mockClear();
    updateManyMock.mockClear();
    countMock.mockClear();
    queryRawMock.mockClear();
    publishWake.mockClear();
    publishWake.mockResolvedValue({ messageId: "mid-wake" });
    findManyMock.mockImplementation(async () => []);
    updateManyMock.mockImplementation(async () => ({ count: 0 }));
    queryRawMock.mockImplementation(async () => []);
  });

  it("upsertPendingForContacts reativa linha sent/failed para pending com attemptCount 0 e incrementa generation", async () => {
    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);

    await repo.upsertPendingForContacts([
      {
        emailContactId: "contact-1",
        teamId: "team-1",
        emailImportJobId: "job-new",
      },
    ]);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const args = upsertMock.mock.calls[0]?.[0] as {
      where: { emailContactId: string };
      create: { status: string; attemptCount: number; emailImportJobId: string };
      update: {
        status: string;
        attemptCount: number;
        emailImportJobId: string;
        lastError: null;
        generation: { increment: number };
      };
    };

    expect(args.where.emailContactId).toBe("contact-1");
    expect(args.create.status).toBe("pending");
    expect(args.create.attemptCount).toBe(0);
    expect(args.create.emailImportJobId).toBe("job-new");
    expect(args.update.status).toBe("pending");
    expect(args.update.attemptCount).toBe(0);
    expect(args.update.emailImportJobId).toBe("job-new");
    expect(args.update.lastError).toBeNull();
    expect(args.update.generation).toEqual({ increment: 1 });
    expect(publishWake).toHaveBeenCalledTimes(1);
  });

  it("claimDue usa SKIP LOCKED e não duplica item entre claims concorrentes", async () => {
    findManyMock.mockImplementation(async () => []);

    let remaining = 1;
    queryRawMock.mockImplementation(async () => {
      if (remaining <= 0) return [];
      remaining -= 1;
      return [
        {
          id: "outbox-1",
          emailContactId: "contact-1",
          teamId: "team-1",
          emailImportJobId: "job-1",
          attemptCount: 0,
          generation: 2,
        },
      ];
    });

    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    const [claimA, claimB] = await Promise.all([repo.claimDue(10), repo.claimDue(10)]);

    const allClaimed = [...claimA, ...claimB];
    expect(allClaimed).toHaveLength(1);
    expect(allClaimed[0]?.id).toBe("outbox-1");
    expect(allClaimed[0]?.generation).toBe(2);
    expect(queryRawMock).toHaveBeenCalled();
  });

  it("corrida reimport-durante-processing: worker obsoleto não marca sent após upsert incrementar generation", async () => {
    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string; generation?: number };
    }) => {
      if (
        args?.where?.id === "outbox-1" &&
        args?.where?.status === "processing" &&
        args?.where?.generation === 1
      ) {
        return { count: 0 };
      }
      if (
        args?.where?.id === "outbox-1" &&
        args?.where?.status === "processing" &&
        args?.where?.generation === 2
      ) {
        return { count: 1 };
      }
      return { count: 0 };
    });

    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    const staleWorker = await repo.markSent("outbox-1", 1);
    const currentWorker = await repo.markSent("outbox-1", 2);

    expect(staleWorker).toBe(false);
    expect(currentWorker).toBe(true);
  });

  it("corrida claim-travado-durante-processing: recuperação incrementa generation e attemptCount; worker obsoleto não finaliza", async () => {
    findManyMock.mockImplementation(async (args?: { where?: { status?: string } }) => {
      if (args?.where?.status === "processing") {
        return [
          {
            id: "outbox-stale",
            emailContactId: "contact-stale",
            teamId: "team-1",
            emailImportJobId: "job-1",
            attemptCount: 0,
            generation: 0,
          },
        ];
      }
      return [];
    });

    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string; generation?: number };
      data?: { status?: string; attemptCount?: number; generation?: { increment: number } };
    }) => {
      if (
        args?.where?.status === "processing" &&
        args?.where?.id === "outbox-stale" &&
        args.data?.generation
      ) {
        expect(args.data.generation).toEqual({ increment: 1 });
        expect(args.data.attemptCount).toBe(1);
        expect(args.data.status).toBe("pending");
        return { count: 1 };
      }
      if (
        args?.where?.id === "outbox-stale" &&
        args?.where?.status === "processing" &&
        args?.where?.generation === 0
      ) {
        return { count: 0 };
      }
      if (
        args?.where?.id === "outbox-stale" &&
        args?.where?.status === "processing" &&
        args?.where?.generation === 1
      ) {
        return { count: 1 };
      }
      return { count: 0 };
    });

    queryRawMock.mockImplementation(async () => []);

    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    await repo.claimDue(10);

    const staleWorker = await repo.markSent("outbox-stale", 0);
    const recoveredWorker = await repo.markSent("outbox-stale", 1);

    expect(staleWorker).toBe(false);
    expect(recoveredWorker).toBe(true);
  });

  it("recuperação de claim travado marca failed quando attemptCount atinge o teto", async () => {
    findManyMock.mockImplementation(async (args?: { where?: { status?: string } }) => {
      if (args?.where?.status === "processing") {
        return [
          {
            id: "outbox-exhausted",
            emailContactId: "contact-exhausted",
            teamId: "team-1",
            emailImportJobId: "job-1",
            attemptCount: 4,
            generation: 3,
          },
        ];
      }
      return [];
    });

    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string };
      data?: { status?: string; attemptCount?: number };
    }) => {
      if (args?.where?.id === "outbox-exhausted" && args?.where?.status === "processing") {
        expect(args.data?.attemptCount).toBe(5);
        expect(args.data?.status).toBe("failed");
        return { count: 1 };
      }
      return { count: 0 };
    });

    queryRawMock.mockImplementation(async () => []);

    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    await repo.claimDue(10);
  });

  it("countPendingByImportJobId escopa por emailImportJobId, não por lista", async () => {
    countMock.mockImplementation(async () => 7);
    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);

    const pending = await repo.countPendingByImportJobId("job-current");

    expect(pending).toBe(7);
    const args = countMock.mock.calls[0]?.[0] as {
      where: { emailImportJobId: string; status: { in: string[] } };
    };
    expect(args.where.emailImportJobId).toBe("job-current");
    expect(args.where.status.in).toEqual(["pending", "processing"]);
  });

  it("getBacklogSnapshot agrega pending/processing e idade máxima", async () => {
    queryRawMock.mockImplementation(async () => [
      { status: "pending", total: 120, oldestAgeSeconds: 3600.4 },
      { status: "processing", total: 8, oldestAgeSeconds: 90 },
    ]);

    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    const snapshot = await repo.getBacklogSnapshot();

    expect(snapshot).toEqual({
      pending: 120,
      processing: 8,
      maxPendingAgeSeconds: 3600,
    });
  });

  it("enqueueMissingForList consulta contatos sem identity e upserta outbox", async () => {
    queryRawMock.mockImplementation(async () => [{ id: "contact-missing-1" }, { id: "contact-missing-2" }]);

    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    const enqueued = await repo.enqueueMissingForList("team-1", "list-1");

    expect(enqueued).toBe(2);
    expect(queryRawMock).toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledTimes(2);
    const first = upsertMock.mock.calls[0]?.[0] as unknown as {
      create: { emailContactId: string; teamId: string; emailImportJobId: string | null };
    };
    expect(first.create.emailContactId).toBe("contact-missing-1");
    expect(first.create.teamId).toBe("team-1");
    expect(first.create.emailImportJobId).toBeNull();
    expect(publishWake).toHaveBeenCalledTimes(1);
  });

  it("upsertPendingForContacts vazio não publica wake", async () => {
    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    await repo.upsertPendingForContacts([]);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(publishWake).not.toHaveBeenCalled();
  });

  it("enqueueMissingForList vazio não publica wake", async () => {
    queryRawMock.mockImplementation(async () => []);
    const repo = new EmailContactRadarSyncOutboxRepository(publishWake);
    const enqueued = await repo.enqueueMissingForList("team-1", "list-1");
    expect(enqueued).toBe(0);
    expect(upsertMock).not.toHaveBeenCalled();
    expect(publishWake).not.toHaveBeenCalled();
  });
});
