import { beforeEach, describe, expect, it, mock } from "bun:test";

const updateManyMock = mock(async () => ({ count: 0 }));
const createMock = mock(async () => ({}));
const updateMock = mock(async () => ({}));
const queryRawMock = mock(async (): Promise<unknown[]> => []);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    teamWebhookOutbox: {
      create: createMock,
      updateMany: updateManyMock,
      update: updateMock,
    },
    $queryRaw: queryRawMock,
  },
}));

const { TeamWebhookOutboxRepository } = await import("./TeamWebhookOutboxRepository");

describe("TeamWebhookOutboxRepository", () => {
  beforeEach(() => {
    updateManyMock.mockClear();
    createMock.mockClear();
    updateMock.mockClear();
    queryRawMock.mockClear();
    updateManyMock.mockImplementation(async () => ({ count: 0 }));
    queryRawMock.mockImplementation(async () => []);
  });

  it("claimDue usa SKIP LOCKED e não duplica item entre claims concorrentes", async () => {
    let remaining = 1;
    queryRawMock.mockImplementation(async () => {
      if (remaining <= 0) return [];
      remaining -= 1;
      return [
        {
          id: "outbox-1",
          teamId: "team-1",
          webhookId: "webhook-1",
          eventKey: "lead_created",
          payload: { type: "lead.created" },
          status: "processing",
          attemptCount: 0,
          nextAttemptAt: new Date("2026-08-12T12:00:00.000Z"),
        },
      ];
    });

    const repo = new TeamWebhookOutboxRepository();
    const [claimA, claimB] = await Promise.all([repo.claimDue(10), repo.claimDue(10)]);

    const allClaimed = [...claimA, ...claimB];
    expect(allClaimed).toHaveLength(1);
    expect(allClaimed[0]?.id).toBe("outbox-1");
    expect(allClaimed[0]?.status).toBe("processing");
    expect(queryRawMock).toHaveBeenCalled();
  });

  it("claimDue com limit 0 não consulta o banco", async () => {
    const repo = new TeamWebhookOutboxRepository();
    const claimed = await repo.claimDue(0);
    expect(claimed).toEqual([]);
    expect(queryRawMock).not.toHaveBeenCalled();
    expect(updateManyMock).not.toHaveBeenCalled();
  });
});
