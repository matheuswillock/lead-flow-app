import { beforeEach, describe, expect, it, mock } from "bun:test";

const findManyMock = mock(async () => [] as Array<Record<string, unknown>>);
const updateManyMock = mock(async () => ({ count: 1 }));
const upsertMock = mock(async () => ({}));
const findUniqueMock = mock(async () => null);

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    resendWebhookProcessingFailure: {
      findMany: findManyMock,
      updateMany: updateManyMock,
      upsert: upsertMock,
      findUnique: findUniqueMock,
    },
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
    findManyMock.mockImplementation(async () => []);
    updateManyMock.mockImplementation(async () => ({ count: 1 }));
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
});
