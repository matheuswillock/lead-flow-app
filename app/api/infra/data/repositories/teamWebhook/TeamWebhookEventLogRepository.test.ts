import { beforeEach, describe, expect, it, mock } from "bun:test";

/**
 * SPEC 10, A-E6 (DA6, W7/W11) — T-10.16: `create` poda por (teamId,
 * webhookId) e mantém só os 15 mais recentes, igual ao legado
 * (`StudioWebhookIntegrationService.ts:111-146`).
 */
const createMock = mock(async (_args: { data: Record<string, unknown> }) => ({}));
const findManyMock = mock(
  async (_args: { where: { teamId: string; webhookId: string }; skip: number }): Promise<Array<{ id: string }>> => []
);
const deleteManyMock = mock(async (_args: { where: { id: { in: string[] } } }) => ({ count: 0 }));

const txClient = {
  teamWebhookEventLog: {
    create: createMock,
    findMany: findManyMock,
    deleteMany: deleteManyMock,
  },
};

const transactionMock = mock(async (callback: (tx: typeof txClient) => Promise<unknown>) => {
  return callback(txClient);
});

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    teamWebhookEventLog: txClient.teamWebhookEventLog,
  },
}));

const { TeamWebhookEventLogRepository } = await import("./TeamWebhookEventLogRepository");

describe("TeamWebhookEventLogRepository.create (T-10.16)", () => {
  beforeEach(() => {
    createMock.mockClear();
    findManyMock.mockClear();
    deleteManyMock.mockClear();
    transactionMock.mockClear();
    findManyMock.mockImplementation(async () => []);
  });

  it("grava o log dentro de uma transação com poda por (teamId, webhookId)", async () => {
    const repo = new TeamWebhookEventLogRepository();

    await repo.create({
      teamId: "team-1",
      webhookId: "webhook-1",
      direction: "inbound",
      result: "success",
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledTimes(1);
    const findManyArgs = findManyMock.mock.calls[0]?.[0] as {
      where: { teamId: string; webhookId: string };
      skip: number;
    };
    expect(findManyArgs.where).toEqual({ teamId: "team-1", webhookId: "webhook-1" });
    expect(findManyArgs.skip).toBe(15);
  });

  it("20 logs do mesmo webhook → sobram 15 (deleteMany chamado com os excedentes)", async () => {
    findManyMock.mockImplementation(async () => [
      { id: "log-16" },
      { id: "log-17" },
      { id: "log-18" },
      { id: "log-19" },
      { id: "log-20" },
    ]);
    const repo = new TeamWebhookEventLogRepository();

    await repo.create({
      teamId: "team-1",
      webhookId: "webhook-1",
      direction: "inbound",
      result: "success",
    });

    expect(deleteManyMock).toHaveBeenCalledTimes(1);
    const deleteArgs = deleteManyMock.mock.calls[0]?.[0] as { where: { id: { in: string[] } } };
    expect(deleteArgs.where.id.in).toEqual(["log-16", "log-17", "log-18", "log-19", "log-20"]);
  });

  it("sem excedente (≤15 logs) → não chama deleteMany", async () => {
    findManyMock.mockImplementation(async () => []);
    const repo = new TeamWebhookEventLogRepository();

    await repo.create({
      teamId: "team-1",
      webhookId: "webhook-1",
      direction: "inbound",
      result: "success",
    });

    expect(deleteManyMock).not.toHaveBeenCalled();
  });
});
