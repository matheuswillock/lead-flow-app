import { describe, expect, it } from "bun:test";
import { BethaniaOutboxService, type BethaniaOutboxRepository } from "./BethaniaOutboxService";

function makeRepository(overrides: Partial<BethaniaOutboxRepository> = {}): BethaniaOutboxRepository {
  return {
    enqueue: async () => ({ id: "outbox-1", status: "pending" }),
    claimDue: async () => ({ items: [], suppressed: 0 }),
    recordOutcome: async () => undefined,
    ...overrides,
  };
}

const row = { id: "outbox-1", eventType: "agenda.daily_0700" as const, phone: "+5511999999999", message: "private body" };

describe("BethaniaOutboxService", () => {
  it("dispatches a claimed item once and records sanitized accepted outcome", async () => {
    const outcomes: unknown[] = [];
    const messages: unknown[] = [];
    const repository = makeRepository({ claimDue: async () => ({ items: [row], suppressed: 2 }), recordOutcome: async (...args) => { outcomes.push(args); } });
    const service = new BethaniaOutboxService(repository, async (event) => { messages.push(event); return { accepted: true }; });

    const result = await service.dispatchDue(4);

    expect(result).toEqual({ accepted: 1, failed: 0, suppressed: 2 });
    expect(messages).toEqual([{ eventId: row.id, eventType: row.eventType, phone: row.phone, message: row.message }]);
    expect(outcomes).toEqual([["outbox-1", { status: "sent", errorCode: null, clearPayload: true }]]);
  });

  it("does not automatically retry ambiguous transport failures and removes payload", async () => {
    const outcomes: unknown[] = [];
    const repository = makeRepository({ claimDue: async () => ({ items: [row], suppressed: 0 }), recordOutcome: async (...args) => { outcomes.push(args); } });
    let sends = 0;
    const service = new BethaniaOutboxService(repository, async () => { sends += 1; throw new Error("phone +5511999999999 private body secret"); });

    const result = await service.dispatchDue(4);

    expect(result).toEqual({ accepted: 0, failed: 1, suppressed: 0 });
    expect(sends).toBe(1);
    expect(outcomes).toEqual([["outbox-1", { status: "failed", errorCode: "transport_outcome_unknown", clearPayload: true }]]);
  });
});
