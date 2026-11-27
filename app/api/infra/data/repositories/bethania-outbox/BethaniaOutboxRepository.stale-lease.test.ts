import { beforeEach, describe, expect, it, mock } from "bun:test";

type Args = Record<string, unknown>;
const staleRow = { id: "outbox-stale", profileId: "profile-1", eventType: "agenda.daily_0700" };
const staleFindMany = mock(async (args: Args) => {
  const where = args.where as { status?: string };
  return where.status === "sending" ? [staleRow] : [];
});
const updateMany = mock(async (_args: Args) => ({ count: 1 }));
const deliveryLogCreate = mock(async (_args: Args) => ({}));
const tx = {
  bethaniaOutbox: { findMany: staleFindMany, updateMany },
  bethaniaDeliveryLog: { create: deliveryLogCreate },
};
const transaction = mock(async (callback: (value: typeof tx) => unknown) => callback(tx));
mock.module("@/app/api/infra/data/prisma", () => ({ prisma: { $transaction: transaction } }));

const { PrismaBethaniaOutboxRepository } = await import("./BethaniaOutboxRepository");

describe("PrismaBethaniaOutboxRepository.claimDue stale leases", () => {
  beforeEach(() => {
    staleFindMany.mockClear();
    updateMany.mockClear();
    deliveryLogCreate.mockClear();
    transaction.mockClear();
  });

  it("marks abandoned sending rows as unknown instead of leaving payloads locked forever", async () => {
    await new PrismaBethaniaOutboxRepository().claimDue(5);

    const staleUpdate = updateMany.mock.calls.find(([args]) => {
      const where = args.where as { status?: string };
      return where.status === "sending";
    })?.[0];
    expect(staleUpdate).toBeDefined();
    expect(staleUpdate).toMatchObject({
      where: { id: staleRow.id, status: "sending" },
      data: {
        status: "failed",
        phone: null,
        message: null,
        lockedAt: null,
        lastErrorCode: "delivery_outcome_unknown",
      },
    });
    expect(deliveryLogCreate).toHaveBeenCalledWith({
      data: {
        outboxId: staleRow.id,
        recipientProfileId: staleRow.profileId,
        eventType: staleRow.eventType,
        status: "failed",
        errorCode: "delivery_outcome_unknown",
      },
    });
  });
});
