import { describe, expect, it, mock } from "bun:test";
import { Prisma } from "@prisma/client";
import { withDispatchTerminalCommitRetry } from "./dispatch-reconcile-resilience";

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
});
