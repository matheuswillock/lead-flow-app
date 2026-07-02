import { describe, expect, it } from "bun:test"
import { withConcurrencyLimit } from "./with-concurrency-limit"

describe("withConcurrencyLimit", () => {
  it("returns [] for empty input without calling the worker", async () => {
    let called = false
    const result = await withConcurrencyLimit([], 2, async () => {
      called = true
    })
    expect(result).toEqual([])
    expect(called).toBe(false)
  })

  it("preserves output order even when later items resolve before earlier ones", async () => {
    const delays = [30, 10, 20, 0]
    const result = await withConcurrencyLimit(delays, 4, async (delay, index) => {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return index
    })
    expect(result).toEqual([0, 1, 2, 3])
  })

  it("never runs more than `limit` workers concurrently", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i)
    let inFlight = 0
    let maxInFlight = 0

    await withConcurrencyLimit(items, 3, async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight--
    })

    expect(maxInFlight).toBeLessThanOrEqual(3)
  })

  it("propagates a worker rejection", async () => {
    const items = [1, 2, 3]
    await expect(
      withConcurrencyLimit(items, 2, async (item) => {
        if (item === 2) throw new Error("boom")
        return item
      })
    ).rejects.toThrow("boom")
  })

  it("works correctly when limit >= items.length", async () => {
    const items = [1, 2, 3]
    const result = await withConcurrencyLimit(items, 10, async (item) => item * 2)
    expect(result).toEqual([2, 4, 6])
  })
})
