import { describe, expect, it, mock } from "bun:test"
import { isDeadlockError, withDeadlockRetry } from "./with-deadlock-retry"

describe("isDeadlockError", () => {
  it("detecta código Postgres 40P01", () => {
    expect(isDeadlockError({ code: "40P01" })).toBe(true)
    expect(isDeadlockError({ meta: { code: "40P01" } })).toBe(true)
  })

  it("detecta código Prisma P2034", () => {
    expect(isDeadlockError({ code: "P2034" })).toBe(true)
    expect(isDeadlockError({ meta: { code: "P2034" } })).toBe(true)
    expect(
      isDeadlockError(new Error("Transaction failed due to a write conflict or a deadlock"))
    ).toBe(true)
  })

  it("detecta mensagem de deadlock", () => {
    expect(isDeadlockError(new Error("deadlock detected"))).toBe(true)
    expect(isDeadlockError(new Error("Error: 40P01"))).toBe(true)
  })

  it("ignora outros erros", () => {
    expect(isDeadlockError(new Error("unique constraint"))).toBe(false)
    expect(isDeadlockError(null)).toBe(false)
  })
})

describe("withDeadlockRetry", () => {
  it("retorna na primeira tentativa sem erro", async () => {
    const result = await withDeadlockRetry(async () => 42)
    expect(result).toBe(42)
  })

  it("retenta e sucede após deadlock", async () => {
    let calls = 0
    const onRetry = mock(() => undefined)

    const result = await withDeadlockRetry(
      async () => {
        calls += 1
        if (calls === 1) {
          throw new Error("deadlock detected")
        }
        return "ok"
      },
      { maxAttempts: 3, baseDelayMs: 1, onRetry }
    )

    expect(result).toBe("ok")
    expect(calls).toBe(2)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("esgota retries e relança o erro", async () => {
    let calls = 0
    await expect(
      withDeadlockRetry(
        async () => {
          calls += 1
          throw Object.assign(new Error("deadlock detected"), { code: "40P01" })
        },
        { maxAttempts: 2, baseDelayMs: 1 }
      )
    ).rejects.toThrow(/deadlock detected/)
    expect(calls).toBe(2)
  })
})
