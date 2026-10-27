import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Prisma } from "@prisma/client";

type Args = Record<string, unknown>;

const createMock = mock(async (_args: Args) => ({ id: "event-new" }));
const findUniqueMock = mock(async (_args: Args) => null as { id: string; requestHash: string } | null);
const updateMock = mock(async (_args: Args) => ({}));
const updateManyMock = mock(async (_args: Args) => ({ count: 1 }));
const findFirstMock = mock(async (_args: Args) => null as Record<string, unknown> | null);
const deleteManyMock = mock(async (_args: Args) => ({ count: 3 }));

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    teamWebhookInboundEvent: {
      create: createMock,
      findUnique: findUniqueMock,
      update: updateMock,
      updateMany: updateManyMock,
      findFirst: findFirstMock,
      deleteMany: deleteManyMock,
    },
  },
}));

const { TeamWebhookInboundEventRepository } = await import("./TeamWebhookInboundEventRepository");

const input = {
  webhookId: "webhook-1",
  teamId: "team-1",
  contractVersion: 2,
  idempotencyKey: "evento-123",
  requestHash: "hash-a",
  payload: { lead: { name: "Maria" } },
};

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("TeamWebhookInboundEventRepository.receive — idempotência (DA5)", () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({ id: "event-new" });
    findUniqueMock.mockReset();
    findUniqueMock.mockResolvedValue(null);
    updateMock.mockClear();
  });

  it("grava um evento novo e devolve o id", async () => {
    const result = await new TeamWebhookInboundEventRepository().receive(input);
    expect(result).toEqual({ eventId: "event-new", created: true, idempotencyKeyReused: false });
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      data: { webhookId: "webhook-1", idempotencyKey: "evento-123", requestHash: "hash-a", status: "pending" },
    });
  });

  it("mesma chave e mesmo corpo: devolve o mesmo event_id, sem criar outro evento", async () => {
    createMock.mockRejectedValueOnce(uniqueViolation());
    findUniqueMock.mockResolvedValueOnce({ id: "event-original", requestHash: "hash-a" });

    const result = await new TeamWebhookInboundEventRepository().receive(input);

    expect(result).toEqual({ eventId: "event-original", created: false, idempotencyKeyReused: false });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("mesma chave com corpo diferente: devolve o event_id original e marca idempotency_key_reused", async () => {
    createMock.mockRejectedValueOnce(uniqueViolation());
    findUniqueMock.mockResolvedValueOnce({ id: "event-original", requestHash: "hash-OUTRO" });

    const result = await new TeamWebhookInboundEventRepository().receive(input);

    expect(result).toEqual({ eventId: "event-original", created: false, idempotencyKeyReused: true });
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "event-original" },
      data: { idempotencyKeyReused: true },
    });
  });

  it("sem chave de idempotência cada requisição é um evento novo (nunca consulta a unique)", async () => {
    const result = await new TeamWebhookInboundEventRepository().receive({ ...input, idempotencyKey: null });
    expect(result.created).toBe(true);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("erro que não é de unicidade propaga (nenhum evento aceito se perde em silêncio)", async () => {
    createMock.mockRejectedValueOnce(new Error("banco indisponível"));
    await expect(new TeamWebhookInboundEventRepository().receive(input)).rejects.toThrow("banco indisponível");
  });
});

describe("TeamWebhookInboundEventRepository — ciclo de vida do evento", () => {
  beforeEach(() => {
    updateMock.mockClear();
    updateManyMock.mockReset();
    updateManyMock.mockResolvedValue({ count: 1 });
    findFirstMock.mockReset();
    findFirstMock.mockResolvedValue(null);
  });

  it("claimById só pega evento pending (outro worker não processa o mesmo evento duas vezes)", async () => {
    updateManyMock.mockResolvedValueOnce({ count: 0 });
    const claimed = await new TeamWebhookInboundEventRepository().claimById("event-1");
    expect(claimed).toBeNull();
    expect(updateManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "event-1", status: "pending" },
      data: { status: "processing", attemptCount: { increment: 1 } },
    });
  });

  it("markFailed com próxima tentativa volta o evento para pending", async () => {
    const next = new Date("2026-11-03T12:05:00.000Z");
    await new TeamWebhookInboundEventRepository().markFailed("event-1", 1, next, "falhou");
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "event-1" },
      data: { status: "pending", nextAttemptAt: next, attemptCount: 1, lastError: "falhou" },
    });
  });

  it("markFailed sem próxima tentativa é dead-letter (failed)", async () => {
    await new TeamWebhookInboundEventRepository().markFailed("event-1", 5, null, "esgotou");
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({ data: { status: "failed", attemptCount: 5 } });
  });

  it("markProcessed grava o código estável do desfecho e o lead", async () => {
    await new TeamWebhookInboundEventRepository().markProcessed("event-1", {
      resultCode: "lead_merged",
      leadId: "lead-1",
      result: { ignoredFields: ["x"] },
    });
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "event-1" },
      data: { status: "processed", resultCode: "lead_merged", leadId: "lead-1" },
    });
  });

  it("a retenção só apaga eventos terminais, nunca pending/processing", async () => {
    const cutoff = new Date("2026-10-27T00:00:00.000Z");
    const deleted = await new TeamWebhookInboundEventRepository().purgeTerminalOlderThan(cutoff);
    expect(deleted).toBe(3);
    expect(deleteManyMock.mock.calls[0]?.[0]).toMatchObject({
      where: { status: { in: ["processed", "failed"] }, receivedAt: { lt: cutoff } },
    });
  });
});
