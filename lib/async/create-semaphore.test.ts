import { describe, expect, it } from "bun:test"
import { createSemaphore } from "./create-semaphore"

describe("createSemaphore", () => {
  it("never runs more than `limit` tasks concurrently", async () => {
    const semaphore = createSemaphore(2)
    let inFlight = 0
    let maxInFlight = 0

    const tasks = Array.from({ length: 10 }, () =>
      semaphore.run(async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((resolve) => setTimeout(resolve, 5))
        inFlight--
      })
    )

    await Promise.all(tasks)

    expect(maxInFlight).toBeLessThanOrEqual(2)
  })

  it("runs tasks immediately while under the limit", async () => {
    const semaphore = createSemaphore(3)
    const order: number[] = []

    await Promise.all(
      [0, 1, 2].map((i) =>
        semaphore.run(async () => {
          order.push(i)
        })
      )
    )

    expect(order.sort()).toEqual([0, 1, 2])
  })

  it("queues extra tasks and releases the slot after completion (success or error)", async () => {
    const semaphore = createSemaphore(1)
    const events: string[] = []

    const first = semaphore.run(async () => {
      events.push("first:start")
      await new Promise((resolve) => setTimeout(resolve, 5))
      events.push("first:end")
      throw new Error("boom")
    })

    const second = semaphore.run(async () => {
      events.push("second:start")
    })

    await expect(first).rejects.toThrow("boom")
    await second

    expect(events).toEqual(["first:start", "first:end", "second:start"])
  })

  it("clamps a limit below 1 to 1", async () => {
    const semaphore = createSemaphore(0)
    let inFlight = 0
    let maxInFlight = 0

    await Promise.all(
      Array.from({ length: 5 }, () =>
        semaphore.run(async () => {
          inFlight++
          maxInFlight = Math.max(maxInFlight, inFlight)
          await new Promise((resolve) => setTimeout(resolve, 2))
          inFlight--
        })
      )
    )

    expect(maxInFlight).toBe(1)
  })

  it("propagates the return value of the wrapped function", async () => {
    const semaphore = createSemaphore(2)
    const result = await semaphore.run(async () => "ok")
    expect(result).toBe("ok")
  })
})
