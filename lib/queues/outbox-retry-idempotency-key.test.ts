import { describe, expect, it } from "bun:test"
import { buildOutboxRetryIdempotencyKey } from "@/lib/queues/outbox-retry-idempotency-key"

const UUID_SUFFIX = /:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe("buildOutboxRetryIdempotencyKey", () => {
  it("prefixa originalKey, row id e attemptCount e termina com UUID", () => {
    const key = buildOutboxRetryIdempotencyKey({
      originalKey: "evt-1",
      outboxRowId: "row-1",
      attemptCount: 1,
    })

    expect(key.startsWith("evt-1:outbox-retry:row-1:1:")).toBe(true)
    expect(key).toMatch(UUID_SUFFIX)
  })

  it("gera chave distinta em cada chamada com os mesmos argumentos", () => {
    const input = { originalKey: "evt-1", outboxRowId: "row-1", attemptCount: 1 }
    const first = buildOutboxRetryIdempotencyKey(input)
    const second = buildOutboxRetryIdempotencyKey(input)
    expect(first).not.toBe(second)
  })
})
