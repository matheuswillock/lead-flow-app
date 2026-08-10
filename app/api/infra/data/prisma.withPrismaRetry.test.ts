import { describe, expect, it, mock } from "bun:test"
import { Prisma } from "@prisma/client"
import { withPrismaRetry } from "@/app/api/infra/data/withPrismaRetry"

describe("withPrismaRetry", () => {
  it("repete operação em erro transitório P2024", async () => {
    const operation = mock(async () => {
      if (operation.mock.calls.length === 1) {
        throw new Prisma.PrismaClientKnownRequestError("pool timeout", {
          code: "P2024",
          clientVersion: "test",
        })
      }
      return "ok"
    })

    const result = await withPrismaRetry(operation, {
      label: "test-op",
      retries: 1,
      delayMs: 0,
    })

    expect(result).toBe("ok")
    expect(operation).toHaveBeenCalledTimes(2)
  })
})
