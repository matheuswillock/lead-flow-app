import { beforeEach, describe, expect, it, mock } from "bun:test";

const findManyMock = mock(async () => [] as Array<Record<string, unknown>>);
const updateManyMock = mock(async () => ({ count: 1 }));
const upsertMock = mock(async () => ({}));
const findUniqueMock = mock(async () => null);
const queryRawMock = mock(async (): Promise<unknown[]> => []);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    resendWebhookProcessingFailure: {
      findMany: findManyMock,
      updateMany: updateManyMock,
      upsert: upsertMock,
      findUnique: findUniqueMock,
    },
    $queryRaw: queryRawMock,
  },
}));

const { ResendWebhookProcessingFailureRepository } = await import(
  "./ResendWebhookProcessingFailureRepository"
);

describe("ResendWebhookProcessingFailureRepository (D11)", () => {
  beforeEach(() => {
    findManyMock.mockClear();
    updateManyMock.mockClear();
    upsertMock.mockClear();
    findUniqueMock.mockClear();
    queryRawMock.mockClear();
    findManyMock.mockImplementation(async () => []);
    updateManyMock.mockImplementation(async () => ({ count: 1 }));
    queryRawMock.mockImplementation(async () => []);
  });

  it("claimDue recupera linhas processing abandonadas antes de reivindicar pending", async () => {
    findManyMock.mockImplementation(async (args?: { where?: { status?: string } }) => {
      if (args?.where?.status === "processing") {
        return [{ id: "row-stale", attemptCount: 1 }];
      }
      return [];
    });

    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string };
      data?: { status?: string; attemptCount?: number };
    }) => {
      if (args?.where?.id === "row-stale" && args?.where?.status === "processing") {
        expect(args.data?.attemptCount).toBe(2);
        expect(args.data?.status).toBe("pending");
        return { count: 1 };
      }
      return { count: 0 };
    });

    const repo = new ResendWebhookProcessingFailureRepository();
    await repo.claimDue(10);

    expect(findManyMock).toHaveBeenCalled();
    const staleQuery = (findManyMock.mock.calls as unknown as Array<
      [{ where: { status: string; updatedAt: { lt: Date } } }]
    >).find((call) => call[0]?.where?.status === "processing");
    expect(staleQuery).toBeDefined();
    expect(queryRawMock).toHaveBeenCalled();
  });

  it("recuperação de claim travado marca failed quando attemptCount atinge o teto", async () => {
    findManyMock.mockImplementation(async (args?: { where?: { status?: string } }) => {
      if (args?.where?.status === "processing") {
        return [{ id: "row-exhausted", attemptCount: 4 }];
      }
      return [];
    });

    updateManyMock.mockImplementation(async (args?: {
      where?: { id?: string; status?: string };
      data?: { status?: string; attemptCount?: number };
    }) => {
      if (args?.where?.id === "row-exhausted" && args?.where?.status === "processing") {
        expect(args.data?.attemptCount).toBe(5);
        expect(args.data?.status).toBe("failed");
        return { count: 1 };
      }
      return { count: 0 };
    });

    const repo = new ResendWebhookProcessingFailureRepository();
    await repo.claimDue(10);
  });

  it("claimDue usa uma única query atômica (FOR UPDATE SKIP LOCKED) para reservar o lote", async () => {
    queryRawMock.mockImplementation(async () => [
      {
        id: "row-1",
        svixId: "svix-1",
        eventType: "email.delivered",
        payload: { foo: "bar" },
        attemptCount: 1,
      },
    ]);

    const repo = new ResendWebhookProcessingFailureRepository();
    const claimed = await repo.claimDue(2000);

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(updateManyMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "row-1" }) })
    );
    expect(claimed).toEqual([
      {
        id: "row-1",
        svixId: "svix-1",
        eventType: "email.delivered",
        payload: { foo: "bar" },
        attemptCount: 1,
      },
    ]);
  });

  it("claimDue com limit 0 não consulta o banco", async () => {
    const repo = new ResendWebhookProcessingFailureRepository();
    const claimed = await repo.claimDue(0);
    expect(claimed).toEqual([]);
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("claimDue converte attemptCount bigint retornado pelo Postgres para number", async () => {
    queryRawMock.mockImplementation(async () => [
      {
        id: "row-2",
        svixId: "svix-2",
        eventType: "email.bounced",
        payload: { foo: "baz" },
        attemptCount: BigInt(3),
      },
    ]);

    const repo = new ResendWebhookProcessingFailureRepository();
    const [claimed] = await repo.claimDue(5);

    expect(claimed?.attemptCount).toBe(3);
    expect(typeof claimed?.attemptCount).toBe("number");
  });
});
