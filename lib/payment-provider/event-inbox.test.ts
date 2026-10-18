import { describe, expect, it } from "bun:test"
import type { ProviderWebhookEvent } from "./types"
import {
  PaymentProviderEventProcessor,
  type PaymentProviderEventInboxRepository,
} from "./event-inbox"

const event: ProviderWebhookEvent = {
  eventId: "evt_1",
  event: "PAYMENT_CONFIRMED",
  environment: "DEV",
  externalPaymentId: "pay_1",
  method: "PIX",
  amountInCents: 1250,
  occurredAt: "2026-10-20T12:00:00Z",
  disputeEpoch: null,
  status: "CONFIRMED",
}

class MemoryInboxRepository implements PaymentProviderEventInboxRepository {
  private nextClaimToken = 1
  readonly rows = new Map<
    string,
    {
      payloadHash: string
      status: "processing" | "failed" | "processed"
      updatedAt: Date
      claimToken: string
    }
  >()

  async claim(input: Parameters<PaymentProviderEventInboxRepository["claim"]>[0]) {
    const existing = this.rows.get(input.dedupeKey)
    if (!existing) {
      this.rows.set(input.dedupeKey, {
        payloadHash: input.payloadHash,
        status: "processing",
        updatedAt: input.now,
        claimToken: this.createClaimToken(),
      })
      return { kind: "claimed" as const, claimToken: this.rows.get(input.dedupeKey)!.claimToken }
    }
    if (existing.payloadHash !== input.payloadHash) return { kind: "conflict" as const }
    if (existing.status === "failed") {
      existing.status = "processing"
      existing.updatedAt = input.now
      existing.claimToken = this.createClaimToken()
      return { kind: "claimed" as const, claimToken: existing.claimToken }
    }
    if (existing.status === "processing" && existing.updatedAt < input.staleBefore) {
      existing.updatedAt = input.now
      existing.claimToken = this.createClaimToken()
      return { kind: "claimed" as const, claimToken: existing.claimToken }
    }
    return { kind: "duplicate" as const }
  }

  async markProcessed(input: { dedupeKey: string; claimToken: string }): Promise<void> {
    const row = this.rows.get(input.dedupeKey)
    if (row?.claimToken === input.claimToken) row.status = "processed"
  }

  async markFailed(input: { dedupeKey: string; claimToken: string }): Promise<void> {
    const row = this.rows.get(input.dedupeKey)
    if (row?.claimToken === input.claimToken) row.status = "failed"
  }

  async assertClaimActive(input: {
    dedupeKey: string
    claimToken: string
    now: Date
    staleBefore: Date
  }): Promise<boolean> {
    const row = this.rows.get(input.dedupeKey)
    if (!row || row.claimToken !== input.claimToken || row.status !== "processing") return false
    if (row.updatedAt < input.staleBefore) return false
    row.updatedAt = input.now
    return true
  }

  private createClaimToken(): string {
    const claimToken = `claim_${this.nextClaimToken}`
    this.nextClaimToken += 1
    return claimToken
  }
}

describe("PaymentProviderEventProcessor", () => {
  it("does not apply a duplicate event twice", async () => {
    const repository = new MemoryInboxRepository()
    const processor = new PaymentProviderEventProcessor(repository)
    let applications = 0

    const input = {
      provider: "ABACATE_PAY" as const,
      environment: "DEV" as const,
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_1"}',
      event,
      currentStatus: "PENDING" as const,
      apply: async () => {
        applications += 1
      },
    }

    await expect(processor.process(input)).resolves.toMatchObject({ action: "apply" })
    await expect(processor.process(input)).resolves.toEqual({ action: "duplicate" })
    expect(applications).toBe(1)
  })

  it("rejects the same event id when its raw payload changes", async () => {
    const repository = new MemoryInboxRepository()
    const processor = new PaymentProviderEventProcessor(repository)
    const apply = async () => undefined

    await processor.process({
      provider: "ABACATE_PAY",
      environment: "DEV",
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_1"}',
      event,
      currentStatus: "PENDING",
      apply,
    })

    await expect(
      processor.process({
        provider: "ABACATE_PAY",
        environment: "DEV",
        externalAccountContext: "account_a",
        rawBody: '{"id":"evt_1","tampered":true}',
        event,
        currentStatus: "PENDING",
        apply,
      }),
    ).rejects.toThrow("payload")
  })

  it("records late events as ignored without changing the attempt", async () => {
    const repository = new MemoryInboxRepository()
    const processor = new PaymentProviderEventProcessor(repository)

    await expect(
      processor.process({
        provider: "ABACATE_PAY",
        environment: "DEV",
        externalAccountContext: "account_a",
        rawBody: '{"id":"evt_2"}',
        event,
        currentStatus: "REFUNDED",
        apply: async () => {
          throw new Error("late event must not be applied")
        },
      }),
    ).resolves.toEqual({ action: "ignore", nextStatus: "REFUNDED" })
  })

  it("reclaims a failed inbox event with the same payload hash", async () => {
    const repository = new MemoryInboxRepository()
    const processor = new PaymentProviderEventProcessor(repository)
    let attempts = 0
    const input = {
      provider: "ABACATE_PAY" as const,
      environment: "DEV" as const,
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_retry"}',
      event,
      currentStatus: "PENDING" as const,
      apply: async () => {
        attempts += 1
        if (attempts === 1) throw new Error("transient consumer failure")
      },
    }

    await expect(processor.process(input)).rejects.toThrow("transient")
    await expect(processor.process(input)).resolves.toMatchObject({ action: "apply" })
    expect(attempts).toBe(2)
  })

  it("does not apply an event twice when marking processed fails after apply", async () => {
    const repository = new MemoryInboxRepository()
    const processor = new PaymentProviderEventProcessor(repository)
    let applications = 0
    const input = {
      provider: "ABACATE_PAY" as const,
      environment: "DEV" as const,
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_mark_processed"}',
      event,
      currentStatus: "PENDING" as const,
      apply: async () => {
        applications += 1
      },
    }
    const markProcessed = repository.markProcessed.bind(repository)
    repository.markProcessed = async () => {
      throw new Error("inbox database unavailable")
    }

    await expect(processor.process(input)).rejects.toThrow("inbox database")
    repository.markProcessed = markProcessed
    await expect(processor.process(input)).resolves.toEqual({ action: "duplicate" })
    expect(applications).toBe(1)
  })

  it("reclaims a stale processing lease, but not a live one", async () => {
    const repository = new MemoryInboxRepository()
    const now = new Date("2026-10-20T12:00:00Z")
    const processor = new PaymentProviderEventProcessor(repository, {
      now: () => now,
      processingLeaseMs: 60_000,
    })
    let applications = 0
    const input = {
      provider: "ABACATE_PAY" as const,
      environment: "DEV" as const,
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_stale"}',
      event,
      currentStatus: "PENDING" as const,
      apply: async () => {
        applications += 1
      },
    }

    const markProcessed = repository.markProcessed.bind(repository)
    repository.markProcessed = async () => {
      throw new Error("lease persistence unavailable")
    }
    await expect(processor.process(input)).rejects.toThrow("lease persistence")
    expect(await processor.process(input)).toEqual({ action: "duplicate" })
    repository.markProcessed = markProcessed
    const row = [...repository.rows.values()][0]
    if (!row) throw new Error("claim row missing")
    row.updatedAt = new Date("2026-10-20T11:00:00Z")
    repository.markProcessed = async () => undefined
    await expect(processor.process(input)).resolves.toMatchObject({ action: "apply" })
    expect(applications).toBe(2)
  })

  it("does not confirm an event that requires reconciliation", async () => {
    const repository = new MemoryInboxRepository()
    const processor = new PaymentProviderEventProcessor(repository)
    let applications = 0

    await expect(
      processor.process({
        provider: "ABACATE_PAY",
        environment: "DEV",
        externalAccountContext: "account_a",
        rawBody: '{"id":"evt_unknown"}',
        event: {
          ...event,
          eventId: "evt_unknown",
          externalPaymentId: "pay_unknown",
          status: "UNKNOWN",
          reason: "REMOTE_ERROR",
          requiresReconciliation: true,
        },
        currentStatus: "PENDING",
        apply: async () => {
          applications += 1
        },
      }),
    ).resolves.toEqual({ action: "reconcile", nextStatus: "UNKNOWN" })

    expect(applications).toBe(0)
  })

  it("marks the event failed when reading the current status fails", async () => {
    const repository = new MemoryInboxRepository()
    const processor = new PaymentProviderEventProcessor(repository)

    await expect(
      processor.process({
        provider: "ABACATE_PAY",
        environment: "DEV",
        externalAccountContext: "account_a",
        rawBody: '{"id":"evt_status_failure"}',
        event: { ...event, eventId: "evt_status_failure" },
        getCurrentStatus: async () => {
          throw new Error("payment status unavailable")
        },
        apply: async () => undefined,
      }),
    ).rejects.toThrow("payment status unavailable")

    const row = [...repository.rows.values()][0]
    expect(row?.status).toBe("failed")
  })

  it("does not let an expired claim owner fail its replacement claim", async () => {
    const repository = new MemoryInboxRepository()
    const now = new Date("2026-10-20T12:00:00Z")
    const processor = new PaymentProviderEventProcessor(repository, {
      now: () => now,
      processingLeaseMs: 60_000,
    })
    let rejectFirstLookup: ((error: Error) => void) | undefined
    let lookupCount = 0
    const input = {
      provider: "ABACATE_PAY" as const,
      environment: "DEV" as const,
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_fenced"}',
      event: { ...event, eventId: "evt_fenced" },
      getCurrentStatus: async () => {
        lookupCount += 1
        if (lookupCount === 1) {
          return new Promise<"PENDING">((_, reject) => {
            rejectFirstLookup = reject
          })
        }
        return "PENDING" as const
      },
      apply: async () => undefined,
    }

    const firstProcessor = processor.process(input)
    await Promise.resolve()
    const row = [...repository.rows.values()][0]
    if (!row) throw new Error("claim row missing")
    row.updatedAt = new Date("2026-10-20T11:00:00Z")

    await expect(processor.process(input)).resolves.toEqual({ action: "apply", nextStatus: "CONFIRMED" })
    rejectFirstLookup?.(new Error("original lookup failed"))
    await expect(firstProcessor).rejects.toThrow("original lookup failed")
    expect(row.status).toBe("processed")
  })

  it("does not apply after its claim expires during a slow status lookup", async () => {
    const repository = new MemoryInboxRepository()
    const now = new Date("2026-10-20T12:00:00Z")
    const processor = new PaymentProviderEventProcessor(repository, {
      now: () => now,
      processingLeaseMs: 60_000,
    })
    let resolveFirstLookup: ((status: "PENDING") => void) | undefined
    let lookupCount = 0
    let applications = 0
    const input = {
      provider: "ABACATE_PAY" as const,
      environment: "DEV" as const,
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_slow_lookup"}',
      event: { ...event, eventId: "evt_slow_lookup" },
      getCurrentStatus: async () => {
        lookupCount += 1
        if (lookupCount === 1) {
          return new Promise<"PENDING">((resolve) => {
            resolveFirstLookup = resolve
          })
        }
        return "PENDING" as const
      },
      apply: async () => {
        applications += 1
      },
    }

    const firstProcessor = processor.process(input)
    await Promise.resolve()
    const row = [...repository.rows.values()][0]
    if (!row) throw new Error("claim row missing")
    row.updatedAt = new Date("2026-10-20T11:00:00Z")

    await expect(processor.process(input)).resolves.toEqual({ action: "apply", nextStatus: "CONFIRMED" })
    resolveFirstLookup?.("PENDING")
    await expect(firstProcessor).resolves.toEqual({ action: "duplicate" })
    expect(applications).toBe(1)
  })

  it("renews the lease using a fresh clock after status lookup", async () => {
    const repository = new MemoryInboxRepository()
    let currentTime = new Date("2026-10-20T12:00:00Z")
    const processor = new PaymentProviderEventProcessor(repository, {
      now: () => new Date(currentTime),
      processingLeaseMs: 60_000,
    })
    let applications = 0

    const input = {
      provider: "ABACATE_PAY" as const,
      environment: "DEV" as const,
      externalAccountContext: "account_a",
      rawBody: '{"id":"evt_clock_refresh"}',
      event: { ...event, eventId: "evt_clock_refresh" },
      getCurrentStatus: async () => {
        currentTime = new Date("2026-10-20T12:02:00Z")
        return "PENDING" as const
      },
      apply: async () => {
        applications += 1
      },
    }

    await expect(processor.process(input)).resolves.toEqual({ action: "duplicate" })
    expect(applications).toBe(0)
  })
})
