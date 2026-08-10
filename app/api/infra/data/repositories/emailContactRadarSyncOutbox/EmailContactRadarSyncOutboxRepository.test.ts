import { beforeEach, describe, expect, it, mock } from "bun:test";

const upsertMock = mock(
  async (_args: {
    where: { emailContactId: string };
    create: { status: string; attemptCount: number; emailImportJobId: string };
    update: { status: string; attemptCount: number; emailImportJobId: string; lastError: null };
  }) => ({})
);
const findManyMock = mock(async () => [] as Array<{
  id: string;
  emailContactId: string;
  teamId: string;
  emailImportJobId: string | null;
  attemptCount: number;
}>);
const updateManyMock = mock(async (_args?: { where?: { id?: string; status?: string } }) => ({
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

  it("upsertPendingForContacts reativa linha sent/failed para pending com attemptCount 0", async () => {
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
      update: { status: string; attemptCount: number; emailImportJobId: string; lastError: null };
    };

    expect(args.where.emailContactId).toBe("contact-1");
    expect(args.create.status).toBe("pending");
    expect(args.create.attemptCount).toBe(0);
    expect(args.create.emailImportJobId).toBe("job-new");
    expect(args.update.status).toBe("pending");
    expect(args.update.attemptCount).toBe(0);
    expect(args.update.emailImportJobId).toBe("job-new");
    expect(args.update.lastError).toBeNull();
  });

  it("claimDue só inclui linhas cujo updateMany pending→processing retorna count 1 (claim concorrente)", async () => {
    findManyMock.mockImplementation(async () => [
      {
        id: "outbox-1",
        emailContactId: "contact-1",
        teamId: "team-1",
        emailImportJobId: "job-1",
        attemptCount: 0,
      },
    ]);

    const claimedIds = new Set<string>();
    updateManyMock.mockImplementation(async (args?: { where?: { id?: string; status?: string } }) => {
      if (args?.where?.status === "pending" && args.where.id) {
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
