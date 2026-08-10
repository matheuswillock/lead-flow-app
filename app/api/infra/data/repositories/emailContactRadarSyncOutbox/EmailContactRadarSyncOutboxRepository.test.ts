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
      syncGeneration: { increment: number };
    };
  }) => ({})
);
const findManyMock = mock(async () => [] as Array<{
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
  syncGeneration: number;
}>);
const updateManyMock = mock(async (_args?: {
  where?: { id?: string; status?: string; syncGeneration?: number };
}) => ({
  count: 0,
}));
const countMock = mock(async (_args?: { where?: { emailImportJobId?: string } }) => 0);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    emailContactRadarSyncOutbox: {
      upsert: upsertMock,
      findMany: findManyMock,
      updateMany: updateManyMock,
      update: mock(async () => ({})),
      count: countMock,
    },
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
    findManyMock.mockImplementation(async () => []);
    updateManyMock.mockImplementation(async () => ({ count: 0 }));
  });

  it("upsertPendingForContacts reativa linha sent/failed para pending com attemptCount 0 e incrementa syncGeneration", async () => {
    const repo = new EmailContactRadarSyncOutboxRepository();

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
        syncGeneration: { increment: number };
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
    expect(args.update.syncGeneration).toEqual({ increment: 1 });
  });

  it("claimDue só inclui linhas cujo updateMany pending→processing retorna count 1 (claim concorrente)", async () => {
    findManyMock.mockImplementation(async () => [
      {
        id: "outbox-1",
        emailContactId: "contact-1",
        teamId: "team-1",
        emailImportJobId: "job-1",
        attemptCount: 0,
        syncGeneration: 2,
      },
    ]);

    const claimedIds = new Set<string>();
    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string; syncGeneration?: number };
    }) => {
      if (
        args?.where?.status === "pending" &&
        args.where.id &&
        args.where.syncGeneration === 2
      ) {
        if (claimedIds.has(args.where.id)) {
          return { count: 0 };
        }
        claimedIds.add(args.where.id);
        return { count: 1 };
      }
      return { count: 0 };
    });

    const repo = new EmailContactRadarSyncOutboxRepository();
    const [claimA, claimB] = await Promise.all([repo.claimDue(10), repo.claimDue(10)]);

    const allClaimed = [...claimA, ...claimB];
    expect(allClaimed).toHaveLength(1);
    expect(allClaimed[0]?.id).toBe("outbox-1");
    expect(allClaimed[0]?.syncGeneration).toBe(2);
  });

  it("markSent só conclui quando status=processing e syncGeneration coincide com o claim", async () => {
    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string; syncGeneration?: number };
    }) => {
      if (
        args?.where?.id === "outbox-1" &&
        args?.where?.status === "processing" &&
        args?.where?.syncGeneration === 1
      ) {
        return { count: 0 };
      }
      if (
        args?.where?.id === "outbox-1" &&
        args?.where?.status === "processing" &&
        args?.where?.syncGeneration === 2
      ) {
        return { count: 1 };
      }
      return { count: 0 };
    });

    const repo = new EmailContactRadarSyncOutboxRepository();
    const stale = await repo.markSent("outbox-1", 1);
    const current = await repo.markSent("outbox-1", 2);

    expect(stale).toBe(false);
    expect(current).toBe(true);
  });

  it("countPendingByImportJobId escopa por emailImportJobId, não por lista", async () => {
    countMock.mockImplementation(async () => 7);
    const repo = new EmailContactRadarSyncOutboxRepository();

    const pending = await repo.countPendingByImportJobId("job-current");

    expect(pending).toBe(7);
    const args = countMock.mock.calls[0]?.[0] as {
      where: { emailImportJobId: string; status: { in: string[] } };
    };
    expect(args.where.emailImportJobId).toBe("job-current");
    expect(args.where.status.in).toEqual(["pending", "processing"]);
  });
});
