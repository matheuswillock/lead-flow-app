import { describe, expect, it, mock } from "bun:test";
import { Prisma } from "@prisma/client";

const connectMock = mock(async () => {});

mock.module("@/app/api/infra/data/prisma", () => ({
  prisma: {
    $connect: connectMock,
  },
}));

const { withDispatchTerminalCommitRetry } = await import("./dispatch-reconcile-resilience");

describe("withDispatchTerminalCommitRetry (D10)", () => {
  it("re-tenta P1001 transitório antes de propagar erro", async () => {
    const operation = mock(async () => {
      if (operation.mock.calls.length === 1) {
        throw new Prisma.PrismaClientKnownRequestError("Timed out fetching connection", {
          code: "P1001",
          clientVersion: "test",
        });
      }
      return { committed: true };
    });

    const result = await withDispatchTerminalCommitRetry(operation);
    expect(result).toEqual({ committed: true });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it("propaga erro após esgotar retries de pool timeout", async () => {
    const operation = mock(async () => {
      throw new Prisma.PrismaClientKnownRequestError("Timed out fetching connection", {
        code: "P1001",
        clientVersion: "test",
      });
    });

    await expect(withDispatchTerminalCommitRetry(operation)).rejects.toThrow();
    expect(operation.mock.calls.length).toBeGreaterThan(1);
  });

  it("não re-executa operação quando verifyAlreadyCommitted detecta commit anterior", async () => {
    let operationCalls = 0;
    const operation = mock(async () => {
      operationCalls += 1;
      throw new Prisma.PrismaClientKnownRequestError("Server closed connection", {
        code: "P1017",
        clientVersion: "test",
      });
    });
    const verifyAlreadyCommitted = mock(async () => {
      if (operationCalls === 0) return null;
      return { parentCampaignId: null };
    });

    const result = await withDispatchTerminalCommitRetry(operation, {
      verifyAlreadyCommitted,
    });

    expect(result).toEqual({ parentCampaignId: null });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(verifyAlreadyCommitted).toHaveBeenCalledTimes(2);
  });
});
